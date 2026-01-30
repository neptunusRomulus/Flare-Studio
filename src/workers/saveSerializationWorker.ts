/**
 * Save Serialization Web Worker
 * 
 * This worker handles computationally expensive serialization tasks
 * (JSON stringify, image processing, etc.) off the main thread.
 * 
 * Messages from main:
 * - { type: 'serialize', data: EditorProjectData }
 * - { type: 'deserialize', json: string }
 * 
 * Messages to main:
 * - { type: 'serialize:success', serialized: string }
 * - { type: 'serialize:error', error: string }
 * - { type: 'deserialize:success', data: object }
 * - { type: 'deserialize:error', error: string }
 */

interface SerializeMessage {
  type: 'serialize';
  data: unknown;
  id: number;
}

interface DeserializeMessage {
  type: 'deserialize';
  json: string;
  id: number;
}

interface SerializeSuccessMessage {
  type: 'serialize:success';
  serialized: string;
  id: number;
  sizeBytes: number;
}

interface SerializeErrorMessage {
  type: 'serialize:error';
  error: string;
  id: number;
}

interface DeserializeSuccessMessage {
  type: 'deserialize:success';
  data: unknown;
  id: number;
}

interface DeserializeErrorMessage {
  type: 'deserialize:error';
  error: string;
  id: number;
}

type WorkerMessage = SerializeMessage | DeserializeMessage;

/**
 * Serialize data to JSON string (expensive on main thread)
 */
function serialize(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    throw new Error(
      `JSON serialization failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Deserialize JSON string to object (can be expensive for large data)
 */
function deserialize(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch (error) {
    throw new Error(
      `JSON deserialization failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Handle incoming messages from main thread
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, id } = event.data;

  try {
    if (type === 'serialize') {
      const msg = event.data as SerializeMessage;
      const serialized = serialize(msg.data);
      const response: SerializeSuccessMessage = {
        type: 'serialize:success',
        serialized,
        id,
        sizeBytes: new Blob([serialized]).size
      };
      self.postMessage(response);
    } else if (type === 'deserialize') {
      const msg = event.data as DeserializeMessage;
      const data = deserialize(msg.json);
      const response: DeserializeSuccessMessage = {
        type: 'deserialize:success',
        data,
        id
      };
      self.postMessage(response);
    } else {
      throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    if (type === 'serialize') {
      const response: SerializeErrorMessage = {
        type: 'serialize:error',
        error: error instanceof Error ? error.message : String(error),
        id
      };
      self.postMessage(response);
    } else if (type === 'deserialize') {
      const response: DeserializeErrorMessage = {
        type: 'deserialize:error',
        error: error instanceof Error ? error.message : String(error),
        id
      };
      self.postMessage(response);
    }
  }
};

// Notify main thread that worker is ready
self.postMessage({ type: 'worker:ready' });
