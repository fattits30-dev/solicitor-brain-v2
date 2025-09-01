"""
Task manager for background job orchestration and status tracking
"""

from typing import Dict, Any, Optional, List
import structlog
from rq.job import Job
from rq.exceptions import NoSuchJobError
from datetime import datetime, timedelta
import uuid

from app.core.redis import (
    get_document_processing_queue, 
    get_embedding_queue, 
    get_search_queue,
    get_redis
)
from app.services.worker_tasks import (
    process_document_job,
    process_ocr_job,
    process_chunking_job,
    process_embeddings_job
)

logger = structlog.get_logger()


class TaskManager:
    """
    Centralized task management for document processing pipeline
    """
    
    def __init__(self):
        self.redis_client = get_redis()
        self.document_queue = get_document_processing_queue()
        self.embedding_queue = get_embedding_queue()
        self.search_queue = get_search_queue()
    
    def enqueue_document_processing(
        self, 
        document_id: str, 
        priority: str = "normal",
        job_timeout: int = 3600  # 1 hour default timeout
    ) -> Dict[str, Any]:
        """
        Enqueue complete document processing pipeline
        
        Args:
            document_id: UUID of document to process
            priority: Job priority (high, normal, low)
            job_timeout: Job timeout in seconds
            
        Returns:
            Dictionary with job information
        """
        
        logger.info("Enqueueing document processing", 
                   document_id=document_id, 
                   priority=priority)
        
        try:
            # Determine queue based on priority
            if priority == "high":
                queue = self.document_queue
                job_timeout = job_timeout // 2  # Higher priority gets shorter timeout
            else:
                queue = self.document_queue
            
            # Enqueue job
            job = queue.enqueue(
                process_document_job,
                document_id,
                job_timeout=job_timeout,
                job_id=f"doc_process_{document_id}_{uuid.uuid4().hex[:8]}",
                meta={
                    "document_id": document_id,
                    "task_type": "document_processing",
                    "priority": priority,
                    "progress": 0,
                    "message": "Queued for processing"
                }
            )
            
            # Store job reference
            self._store_job_reference(document_id, job.id, "document_processing")
            
            result = {
                "job_id": job.id,
                "document_id": document_id,
                "status": "queued",
                "priority": priority,
                "queue_position": self._get_queue_position(job),
                "estimated_start": self._estimate_start_time(job)
            }
            
            logger.info("Document processing job enqueued", **result)
            return result
            
        except Exception as e:
            error_msg = f"Failed to enqueue document processing: {str(e)}"
            logger.error(error_msg, document_id=document_id)
            raise Exception(error_msg)
    
    def enqueue_ocr_only(self, document_id: str) -> Dict[str, Any]:
        """Enqueue OCR processing only"""
        
        job = self.document_queue.enqueue(
            process_ocr_job,
            document_id,
            job_timeout=1800,  # 30 minutes
            job_id=f"ocr_{document_id}_{uuid.uuid4().hex[:8]}",
            meta={
                "document_id": document_id,
                "task_type": "ocr_only",
                "enqueued_at": datetime.utcnow().isoformat()
            }
        )
        
        self._store_job_reference(document_id, job.id, "ocr_only")
        
        return {
            "job_id": job.id,
            "document_id": document_id,
            "status": "queued",
            "task_type": "ocr_only"
        }
    
    def enqueue_chunking_only(self, document_id: str) -> Dict[str, Any]:
        """Enqueue chunking processing only"""
        
        job = self.document_queue.enqueue(
            process_chunking_job,
            document_id,
            job_timeout=600,  # 10 minutes
            job_id=f"chunk_{document_id}_{uuid.uuid4().hex[:8]}",
            meta={
                "document_id": document_id,
                "task_type": "chunking_only",
                "enqueued_at": datetime.utcnow().isoformat()
            }
        )
        
        self._store_job_reference(document_id, job.id, "chunking_only")
        
        return {
            "job_id": job.id,
            "document_id": document_id,
            "status": "queued",
            "task_type": "chunking_only"
        }
    
    def enqueue_embeddings_only(self, document_id: str) -> Dict[str, Any]:
        """Enqueue embedding generation only"""
        
        job = self.embedding_queue.enqueue(
            process_embeddings_job,
            document_id,
            job_timeout=1200,  # 20 minutes
            job_id=f"embed_{document_id}_{uuid.uuid4().hex[:8]}",
            meta={
                "document_id": document_id,
                "task_type": "embeddings_only",
                "enqueued_at": datetime.utcnow().isoformat()
            }
        )
        
        self._store_job_reference(document_id, job.id, "embeddings_only")
        
        return {
            "job_id": job.id,
            "document_id": document_id,
            "status": "queued",
            "task_type": "embeddings_only"
        }
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """
        Get comprehensive job status
        
        Args:
            job_id: RQ job ID
            
        Returns:
            Dictionary with job status and progress
        """
        
        try:
            job = Job.fetch(job_id, connection=self.redis_client)
            
            # Get basic status
            status = {
                "job_id": job_id,
                "status": job.get_status(),
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "ended_at": job.ended_at.isoformat() if job.ended_at else None,
                "result": job.result,
                "exc_info": job.exc_info
            }
            
            # Add metadata if available
            if job.meta:
                status.update({
                    "progress": job.meta.get("progress", 0),
                    "message": job.meta.get("message", ""),
                    "document_id": job.meta.get("document_id"),
                    "task_type": job.meta.get("task_type"),
                    "priority": job.meta.get("priority")
                })
            
            # Calculate duration if job has started
            if job.started_at and job.ended_at:
                duration = job.ended_at - job.started_at
                status["duration_seconds"] = duration.total_seconds()
            elif job.started_at:
                duration = datetime.utcnow() - job.started_at
                status["duration_seconds"] = duration.total_seconds()
            
            # Add queue position for queued jobs
            if status["status"] == "queued":
                status["queue_position"] = self._get_queue_position(job)
            
            return status
            
        except NoSuchJobError:
            return {
                "job_id": job_id,
                "status": "not_found",
                "error": "Job not found"
            }
        except Exception as e:
            return {
                "job_id": job_id,
                "status": "error",
                "error": str(e)
            }
    
    def get_document_jobs(self, document_id: str) -> List[Dict[str, Any]]:
        """
        Get all jobs for a specific document
        
        Args:
            document_id: Document UUID
            
        Returns:
            List of job status dictionaries
        """
        
        try:
            # Get job references from Redis
            job_refs_key = f"doc_jobs:{document_id}"
            job_ids = self.redis_client.smembers(job_refs_key)
            
            jobs = []
            for job_id in job_ids:
                job_status = self.get_job_status(job_id)
                jobs.append(job_status)
            
            # Sort by creation time
            jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            
            return jobs
            
        except Exception as e:
            logger.error("Failed to get document jobs", 
                        document_id=document_id, 
                        error=str(e))
            return []
    
    def cancel_job(self, job_id: str) -> Dict[str, Any]:
        """
        Cancel a queued or running job
        
        Args:
            job_id: RQ job ID
            
        Returns:
            Dictionary with cancellation result
        """
        
        try:
            job = Job.fetch(job_id, connection=self.redis_client)
            
            if job.get_status() in ['queued', 'started']:
                job.cancel()
                
                result = {
                    "job_id": job_id,
                    "status": "cancelled",
                    "message": "Job successfully cancelled"
                }
                
                logger.info("Job cancelled", job_id=job_id)
                return result
            else:
                return {
                    "job_id": job_id,
                    "status": job.get_status(),
                    "message": f"Cannot cancel job with status: {job.get_status()}"
                }
                
        except NoSuchJobError:
            return {
                "job_id": job_id,
                "status": "not_found",
                "error": "Job not found"
            }
        except Exception as e:
            return {
                "job_id": job_id,
                "status": "error",
                "error": str(e)
            }
    
    def get_queue_stats(self) -> Dict[str, Any]:
        """
        Get statistics for all queues
        
        Returns:
            Dictionary with queue statistics
        """
        
        try:
            stats = {
                "document_processing": {
                    "queued": len(self.document_queue),
                    "failed": len(self.document_queue.failed_job_registry),
                    "deferred": len(self.document_queue.deferred_job_registry),
                    "started": len(self.document_queue.started_job_registry)
                },
                "embeddings": {
                    "queued": len(self.embedding_queue),
                    "failed": len(self.embedding_queue.failed_job_registry),
                    "deferred": len(self.embedding_queue.deferred_job_registry),
                    "started": len(self.embedding_queue.started_job_registry)
                },
                "search": {
                    "queued": len(self.search_queue),
                    "failed": len(self.search_queue.failed_job_registry),
                    "deferred": len(self.search_queue.deferred_job_registry),
                    "started": len(self.search_queue.started_job_registry)
                }
            }
            
            # Add overall totals
            stats["totals"] = {
                "queued": sum(q["queued"] for q in stats.values() if isinstance(q, dict)),
                "failed": sum(q["failed"] for q in stats.values() if isinstance(q, dict)),
                "deferred": sum(q["deferred"] for q in stats.values() if isinstance(q, dict)),
                "started": sum(q["started"] for q in stats.values() if isinstance(q, dict))
            }
            
            return stats
            
        except Exception as e:
            logger.error("Failed to get queue stats", error=str(e))
            return {"error": str(e)}
    
    def cleanup_old_jobs(self, days: int = 7) -> Dict[str, Any]:
        """
        Cleanup old completed and failed jobs
        
        Args:
            days: Remove jobs older than this many days
            
        Returns:
            Dictionary with cleanup statistics
        """
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            cleaned = {
                "completed": 0,
                "failed": 0,
                "total": 0
            }
            
            # Clean failed jobs from all queues
            for queue in [self.document_queue, self.embedding_queue, self.search_queue]:
                failed_registry = queue.failed_job_registry
                
                for job_id in failed_registry.get_job_ids():
                    try:
                        job = Job.fetch(job_id, connection=self.redis_client)
                        if job.ended_at and job.ended_at < cutoff_date:
                            job.delete()
                            cleaned["failed"] += 1
                            cleaned["total"] += 1
                    except NoSuchJobError:
                        # Job already deleted, remove from registry
                        failed_registry.remove(job_id)
                        cleaned["failed"] += 1
                        cleaned["total"] += 1
            
            logger.info("Job cleanup completed", **cleaned, days=days)
            return cleaned
            
        except Exception as e:
            logger.error("Job cleanup failed", error=str(e))
            return {"error": str(e)}
    
    def _store_job_reference(self, document_id: str, job_id: str, task_type: str):
        """Store job reference for document tracking"""
        try:
            job_refs_key = f"doc_jobs:{document_id}"
            self.redis_client.sadd(job_refs_key, job_id)
            self.redis_client.expire(job_refs_key, 86400 * 7)  # 7 days TTL
            
            # Store reverse mapping
            job_doc_key = f"job_doc:{job_id}"
            self.redis_client.setex(job_doc_key, 86400 * 7, document_id)
        except Exception as e:
            logger.warning("Failed to store job reference", 
                         document_id=document_id, 
                         job_id=job_id, 
                         error=str(e))
    
    def _get_queue_position(self, job: Job) -> Optional[int]:
        """Get position of job in queue"""
        try:
            queue_jobs = job.connection.lrange(job.origin, 0, -1)
            for i, job_id in enumerate(queue_jobs):
                if job_id.decode() == job.id:
                    return i + 1
            return None
        except Exception:
            return None
    
    def _estimate_start_time(self, job: Job) -> Optional[str]:
        """Estimate when job will start based on queue position"""
        try:
            position = self._get_queue_position(job)
            if position is None:
                return None
            
            # Rough estimate: 5 minutes per job ahead in queue
            estimated_delay = timedelta(minutes=position * 5)
            estimated_start = datetime.utcnow() + estimated_delay
            
            return estimated_start.isoformat()
        except Exception:
            return None


# Global task manager instance
task_manager = TaskManager()