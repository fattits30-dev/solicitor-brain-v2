/**
 * Redis Serialization Utilities
 * Handles proper serialization/deserialization for Redis storage
 */

export interface SerializableJobData {
  [key: string]: any;
}

export interface SerializableJobResult {
  [key: string]: any;
}

/**
 * Safely serialize data for Redis storage
 * Handles Buffers, Dates, Arrays, and complex objects
 */
export function serializeForRedis(data: any): string {
  return JSON.stringify(data, (key, value) => {
    // Handle Buffer objects
    if (Buffer.isBuffer(value)) {
      return {
        __type: 'Buffer',
        data: value.toString('base64'),
      };
    }

    // Handle Uint8Array objects
    if (value instanceof Uint8Array) {
      return {
        __type: 'Uint8Array',
        data: Buffer.from(value).toString('base64'),
      };
    }

    // Handle Date objects
    if (value instanceof Date) {
      return {
        __type: 'Date',
        data: value.toISOString(),
      };
    }

    // Handle embedding arrays (number[])
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'number') {
      // Only serialize if it looks like an embedding vector (> 100 dimensions)
      if (value.length > 100) {
        return {
          __type: 'EmbeddingVector',
          data: value,
          dimensions: value.length,
        };
      }
    }

    // Handle Set objects
    if (value instanceof Set) {
      return {
        __type: 'Set',
        data: Array.from(value),
      };
    }

    // Handle Map objects
    if (value instanceof Map) {
      return {
        __type: 'Map',
        data: Array.from(value.entries()),
      };
    }

    // Handle RegExp objects
    if (value instanceof RegExp) {
      return {
        __type: 'RegExp',
        data: value.toString(),
      };
    }

    // Handle Error objects
    if (value instanceof Error) {
      return {
        __type: 'Error',
        data: {
          name: value.name,
          message: value.message,
          stack: value.stack,
        },
      };
    }

    // Handle circular references by removing them
    if (typeof value === 'object' && value !== null) {
      try {
        JSON.stringify(value);
        return value;
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('circular')) {
          return {
            __type: 'CircularReference',
            data: '[Circular Reference Removed]',
          };
        }
        throw error;
      }
    }

    return value;
  });
}

/**
 * Deserialize data retrieved from Redis
 * Reconstructs Buffers, Dates, Arrays, and complex objects
 */
export function deserializeFromRedis(serializedData: string): any {
  return JSON.parse(serializedData, (key, value) => {
    if (typeof value === 'object' && value !== null && value.__type) {
      switch (value.__type) {
        case 'Buffer':
          return Buffer.from(value.data, 'base64');

        case 'Uint8Array':
          return new Uint8Array(Buffer.from(value.data, 'base64'));

        case 'Date':
          return new Date(value.data);

        case 'EmbeddingVector':
          return value.data; // Return as regular number array

        case 'Set':
          return new Set(value.data);

        case 'Map':
          return new Map(value.data);

        case 'RegExp': {
          const regexMatch = value.data.match(/^\/(.*)\/([gimuy]*)$/);
          if (regexMatch) {
            return new RegExp(regexMatch[1], regexMatch[2]);
          }
          return new RegExp(value.data);
        }

        case 'Error': {
          const error = new Error(value.data.message);
          error.name = value.data.name;
          error.stack = value.data.stack;
          return error;
        }

        case 'CircularReference':
          return value.data;

        default:
          return value;
      }
    }

    return value;
  });
}

/**
 * Sanitize job data before passing to BullMQ
 * Ensures all data is safely serializable
 */
export function sanitizeJobData(data: any): SerializableJobData {
  // First serialize then deserialize to clean the data
  const serialized = serializeForRedis(data);
  return JSON.parse(serialized);
}

/**
 * Sanitize job result before returning from BullMQ
 * Ensures all data is properly deserialized
 */
export function sanitizeJobResult(result: any): SerializableJobResult {
  // Handle results that may contain serialized data
  if (typeof result === 'string') {
    try {
      return deserializeFromRedis(result);
    } catch {
      return { data: result }; // Wrap string in object to match interface
    }
  }

  return result;
}

/**
 * Create a safe copy of an object for Redis storage
 * Removes functions, circular references, and non-serializable properties
 */
export function createSafeCopy(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => createSafeCopy(item));
  }

  const safeCopy: any = {};
  const seen = new WeakSet();

  function copyProps(source: any, target: any, depth = 0) {
    if (depth > 10) return; // Prevent deep recursion
    if (seen.has(source)) return; // Prevent circular references

    seen.add(source);

    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'function') {
        continue; // Skip functions
      }

      if (typeof value === 'object' && value !== null) {
        if (Buffer.isBuffer(value) || value instanceof Uint8Array || value instanceof Date) {
          target[key] = value; // These are handled by serializer
        } else if (Array.isArray(value)) {
          target[key] = value.map((item) => createSafeCopy(item));
        } else {
          target[key] = {};
          copyProps(value, target[key], depth + 1);
        }
      } else {
        target[key] = value;
      }
    }
  }

  copyProps(obj, safeCopy);
  return safeCopy;
}

/**
 * Utility to check if data is safely serializable
 */
export function isSerializable(data: any): boolean {
  try {
    JSON.stringify(data);
    return true;
  } catch (_error) {
    return false;
  }
}
