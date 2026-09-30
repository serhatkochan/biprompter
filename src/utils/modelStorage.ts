/**
 * IndexedDB Model Storage and On-Demand Downloader for Vosk Offline Speech Models
 */

const DB_NAME = 'biprompter-models-db';
const DB_VERSION = 1;
const STORE_NAME = 'models';

export interface DownloadProgress {
  percent: number;        // 0 - 100
  receivedBytes: number;
  totalBytes: number;
  status: 'connecting' | 'downloading' | 'saving' | 'ready' | 'error';
  errorMessage?: string;
}

interface StoredModelRecord {
  modelId: string;
  blob: Blob;
  downloadedAt: number;
  sizeBytes: number;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'modelId' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Check if a model is stored in IndexedDB
 */
export async function isModelDownloaded(modelId: string): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count(modelId);

      req.onsuccess = () => {
        resolve(req.result > 0);
      };
      req.onerror = () => {
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Get all stored model IDs
 */
export async function listDownloadedModelIds(): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();

      req.onsuccess = () => {
        resolve((req.result as string[]) || []);
      };
      req.onerror = () => {
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/**
 * Save model blob into IndexedDB
 */
export async function saveModelBlob(modelId: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: StoredModelRecord = {
      modelId,
      blob,
      downloadedAt: Date.now(),
      sizeBytes: blob.size,
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error('Failed to save model blob'));
  });
}

/**
 * Get model blob from IndexedDB
 */
export async function getModelBlob(modelId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(modelId);

      req.onsuccess = () => {
        const record = req.result as StoredModelRecord | undefined;
        resolve(record ? record.blob : null);
      };
      req.onerror = () => reject(req.error || new Error('Failed to get model blob'));
    });
  } catch {
    return null;
  }
}

// In-memory object URL cache so we don't recreate URLs unnecessarily
const objectUrlCache = new Map<string, string>();

/**
 * Get a blob: URL for a downloaded model.
 */
export async function getModelBlobUrl(modelId: string): Promise<string | null> {
  if (objectUrlCache.has(modelId)) {
    return objectUrlCache.get(modelId)!;
  }

  const blob = await getModelBlob(modelId);
  if (!blob) return null;

  const url = URL.createObjectURL(blob);
  objectUrlCache.set(modelId, url);
  return url;
}

/**
 * Delete a model from IndexedDB to free space
 */
export async function deleteModel(modelId: string): Promise<void> {
  try {
    if (objectUrlCache.has(modelId)) {
      URL.revokeObjectURL(objectUrlCache.get(modelId)!);
      objectUrlCache.delete(modelId);
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(modelId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to delete model'));
    });
  } catch (err) {
    console.warn(`Failed to delete model ${modelId}:`, err);
  }
}

/**
 * Download model with streaming progress and save to IndexedDB
 */
export async function downloadModelWithProgress(
  modelId: string,
  urls: string[],
  onProgress: (progress: DownloadProgress) => void,
  abortSignal?: AbortSignal
): Promise<Blob> {
  onProgress({
    percent: 0,
    receivedBytes: 0,
    totalBytes: 0,
    status: 'connecting',
  });

  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      if (abortSignal?.aborted) {
        throw new Error('Download cancelled');
      }

      const response = await fetch(url, { signal: abortSignal });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status} ${response.statusText}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 40 * 1024 * 1024;

      if (!response.body) {
        // Fallback if ReadableStream is not available
        const blob = await response.blob();
        onProgress({
          percent: 95,
          receivedBytes: blob.size,
          totalBytes: blob.size,
          status: 'saving',
        });
        await saveModelBlob(modelId, blob);
        onProgress({
          percent: 100,
          receivedBytes: blob.size,
          totalBytes: blob.size,
          status: 'ready',
        });
        return blob;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      onProgress({
        percent: 0,
        receivedBytes: 0,
        totalBytes,
        status: 'downloading',
      });

      while (true) {
        if (abortSignal?.aborted) {
          reader.cancel();
          throw new Error('Download cancelled');
        }

        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.length;

        const percent = totalBytes > 0
          ? Math.min(98, Math.round((receivedBytes / totalBytes) * 100))
          : Math.min(95, Math.round(receivedBytes / (40 * 1024 * 1024) * 100));

        onProgress({
          percent,
          receivedBytes,
          totalBytes,
          status: 'downloading',
        });
      }

      onProgress({
        percent: 99,
        receivedBytes,
        totalBytes,
        status: 'saving',
      });

      // Combine chunks into single Blob (application/gzip or zip)
      const blob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' });
      await saveModelBlob(modelId, blob);

      onProgress({
        percent: 100,
        receivedBytes,
        totalBytes,
        status: 'ready',
      });

      return blob;
    } catch (err: any) {
      if (abortSignal?.aborted) throw err;
      lastError = err;
      console.warn(`Failed downloading from ${url}:`, err);
    }
  }

  const message = lastError ? lastError.message : 'Tüm indirme kaynaklarına erişim başarısız oldu.';
  onProgress({
    percent: 0,
    receivedBytes: 0,
    totalBytes: 0,
    status: 'error',
    errorMessage: message,
  });

  throw lastError || new Error(message);
}
