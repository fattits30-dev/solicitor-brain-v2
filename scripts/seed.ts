import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { 
  users, 
  cases, 
  persons, 
  documents, 
  events, 
  drafts, 
  consents,
  auditLog
} from "../shared/schema.js";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  console.log("🌱 Starting database seeding...");

  try {
    // Create users
    console.log("Creating users...");
    const hashedPassword = await bcrypt.hash("password123", 10);
    
    const [adminUser] = await db.insert(users).values({
      username: "admin",
      password: hashedPassword,
      name: "System Administrator",
      role: "admin",
    }).returning();

    const [solicitorUser] = await db.insert(users).values({
      username: "jsolicitor",
      password: hashedPassword,
      name: "Jane Solicitor",
      role: "solicitor",
    }).returning();

    const [paralegalUser] = await db.insert(users).values({
      username: "jdoe",
      password: hashedPassword,
      name: "John Doe",
      role: "paralegal",
    }).returning();

    console.log("✓ Users created");

    // Create persons (clients, opponents, etc.)
    console.log("Creating persons...");
    const [client1] = await db.insert(persons).values({
      role: "client",
      name: "Sarah Johnson",
      contacts: {
        phone: "[REDACTED]",
        email: "[REDACTED]",
        address: "[REDACTED]"
      },
      notes: "PIP appeal case, mobility issues",
    }).returning();

    const [client2] = await db.insert(persons).values({
      role: "client",
      name: "Michael Chen",
      contacts: {
        phone: "[REDACTED]",
        email: "[REDACTED]",
      },
      notes: "Employment tribunal case",
    }).returning();

    const [opponent1] = await db.insert(persons).values({
      role: "opponent",
      name: "DWP",
      contacts: {
        address: "Mail Handling Site A, Wolverhampton, WV98 2BP",
      },
      notes: "Department for Work and Pensions",
    }).returning();

    console.log("✓ Persons created");

    // Create cases
    console.log("Creating cases...");
    const [case1] = await db.insert(cases).values({
      title: "Johnson v DWP - PIP Appeal",
      clientRef: "SJ-2024-001",
      status: "active",
      riskLevel: "high",
      description: "Personal Independence Payment appeal following mandatory reconsideration rejection. Client has significant mobility limitations.",
    }).returning();

    const [case2] = await db.insert(cases).values({
      title: "Chen v TechCorp Ltd",
      clientRef: "MC-2024-002",
      status: "active",
      riskLevel: "medium",
      description: "Unfair dismissal claim. Client was terminated without proper procedure.",
    }).returning();

    const [case3] = await db.insert(cases).values({
      title: "Smith Housing Benefit Appeal",
      clientRef: "AS-2024-003",
      status: "pending",
      riskLevel: "low",
      description: "Housing benefit recalculation dispute with local authority.",
    }).returning();

    console.log("✓ Cases created");

    // Create documents
    console.log("Creating documents...");
    await db.insert(documents).values([
      {
        caseId: case1.id,
        type: "letter",
        source: "client",
        path: "/uploads/mock/sj-medical-evidence.pdf",
        hash: "abc123hash",
        ocrText: "Medical evidence supporting mobility limitations...",
      },
      {
        caseId: case1.id,
        type: "form",
        source: "dwp",
        path: "/uploads/mock/pip-decision-letter.pdf",
        hash: "def456hash",
        ocrText: "We have decided not to award PIP...",
      },
      {
        caseId: case2.id,
        type: "contract",
        source: "client",
        path: "/uploads/mock/employment-contract.pdf",
        hash: "ghi789hash",
        ocrText: "Employment contract terms and conditions...",
      },
    ]);

    console.log("✓ Documents created");

    // Create events
    console.log("Creating events...");
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(events).values([
      {
        caseId: case1.id,
        kind: "letter",
        happenedAt: twoWeeksAgo,
        data: { type: "received", from: "DWP", subject: "Mandatory Reconsideration Decision" },
      },
      {
        caseId: case1.id,
        kind: "task",
        happenedAt: oneWeekAgo,
        data: { type: "completed", description: "Gathered medical evidence" },
      },
      {
        caseId: case1.id,
        kind: "hearing",
        happenedAt: oneMonthFromNow,
        data: { type: "scheduled", venue: "Birmingham Tribunal Centre", time: "10:00 AM" },
      },
      {
        caseId: case2.id,
        kind: "email",
        happenedAt: oneWeekAgo,
        data: { type: "sent", to: "TechCorp HR", subject: "ACAS Early Conciliation" },
      },
    ]);

    console.log("✓ Events created");

    // Create drafts
    console.log("Creating drafts...");
    await db.insert(drafts).values([
      {
        caseId: case1.id,
        title: "PIP Appeal Submission",
        bodyMd: `# PIP Appeal Submission

## Client Details
- Name: [REDACTED]
- Reference: SJ-2024-001

## Grounds for Appeal
1. The decision maker failed to properly consider the medical evidence
2. The assessment was not conducted in accordance with regulations
3. The client's daily living difficulties were not adequately assessed

## Supporting Evidence
- GP Letter dated [DATE]
- Occupational Therapist Report
- Consultant's Assessment`,
        tone: "formal",
        status: "draft",
      },
      {
        caseId: case2.id,
        title: "ET1 Claim Form Draft",
        bodyMd: `# Employment Tribunal Claim

## Claimant Information
[Details to be completed]

## Claim Details
The claimant brings claims for:
1. Unfair dismissal
2. Breach of contract
3. Unpaid wages`,
        tone: "legal",
        status: "review",
      },
    ]);

    console.log("✓ Drafts created");

    // Create consents
    console.log("Creating consents...");
    await db.insert(consents).values([
      {
        personId: client1.id,
        scope: "medical_records_access",
        grantedAt: oneWeekAgo,
      },
      {
        personId: client1.id,
        scope: "ai_processing",
        grantedAt: oneWeekAgo,
      },
      {
        personId: client2.id,
        scope: "data_sharing_acas",
        grantedAt: twoWeeksAgo,
      },
    ]);

    console.log("✓ Consents created");

    // Create audit log entries
    console.log("Creating audit log entries...");
    await db.insert(auditLog).values([
      {
        userId: solicitorUser.id,
        action: "case.created",
        resource: "case",
        resourceId: case1.id,
        metadata: { title: "Johnson v DWP - PIP Appeal" },
        timestamp: twoWeeksAgo,
      },
      {
        userId: solicitorUser.id,
        action: "document.uploaded",
        resource: "document",
        resourceId: "doc-001",
        metadata: { filename: "[REDACTED]", caseId: case1.id },
        redactedData: "filename",
        timestamp: oneWeekAgo,
      },
      {
        userId: paralegalUser.id,
        action: "draft.created",
        resource: "draft",
        resourceId: "draft-001",
        metadata: { title: "PIP Appeal Submission", caseId: case1.id },
        timestamp: oneWeekAgo,
      },
    ]);

    console.log("✓ Audit log entries created");

    console.log("\n✅ Database seeding completed successfully!");
    console.log("\n📝 Test credentials:");
    console.log("  Admin:     admin / password123");
    console.log("  Solicitor: jsolicitor / password123");
    console.log("  Paralegal: jdoe / password123");
    
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

// Run the seed function
seed();