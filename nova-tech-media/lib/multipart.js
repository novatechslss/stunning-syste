import busboy from 'busboy';
import { HttpError } from './http-errors.js';

const OVERHEAD = 64 * 1024; // multipart boundaries + small fields

/** Reads exactly one file field named "file". Rejects oversized bodies before/while buffering. */
export function parseMultipart(req, cfg) {
  return new Promise((resolve, reject) => {
    const ct = String(req.headers['content-type'] || '');
    if (!/^multipart\/form-data;/i.test(ct)) {
      return reject(new HttpError(415, 'UNSUPPORTED_CONTENT_TYPE', 'Send the upload as multipart/form-data with a "file" field.'));
    }
    const len = Number(req.headers['content-length']);
    if (Number.isFinite(len) && len > cfg.maxUploadBytes + OVERHEAD) {
      return reject(new HttpError(413, 'FILE_TOO_LARGE', `Request is larger than the ${(cfg.maxUploadBytes / 1048576).toFixed(1)} MB limit.`));
    }

    let bb;
    try {
      bb = busboy({
        headers: req.headers,
        limits: { fileSize: cfg.maxUploadBytes, files: 1, fields: 4, fieldSize: 1024, parts: 6 }
      });
    } catch {
      return reject(new HttpError(400, 'BAD_MULTIPART', 'The multipart body is malformed.'));
    }

    const chunks = [];
    const fields = {};
    let file = null;
    let finished = false;

    const finish = (err, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (err) {
        req.unpipe(bb);
        bb.destroy();
        return reject(err);
      }
      resolve(value);
    };
    const timer = setTimeout(
      () => finish(new HttpError(408, 'UPLOAD_TIMEOUT', 'The upload took too long and was cancelled.')),
      cfg.requestTimeoutMs
    );

    bb.on('file', (name, stream, info) => {
      if (name !== 'file' || file) {
        stream.resume();
        return;
      }
      stream.on('data', (d) => chunks.push(d));
      stream.on('limit', () =>
        finish(new HttpError(413, 'FILE_TOO_LARGE', `File is larger than the ${(cfg.maxUploadBytes / 1048576).toFixed(1)} MB limit.`))
      );
      stream.on('end', () => {
        file = { buffer: Buffer.concat(chunks), filename: info.filename || '', mimeType: info.mimeType || '' };
      });
    });
    bb.on('field', (name, value) => {
      fields[name] = value;
    });
    bb.on('filesLimit', () => finish(new HttpError(400, 'TOO_MANY_FILES', 'Upload one file per request.')));
    bb.on('partsLimit', () => finish(new HttpError(400, 'BAD_MULTIPART', 'Too many form parts.')));
    bb.on('error', () => finish(new HttpError(400, 'BAD_MULTIPART', 'The multipart body is malformed.')));
    bb.on('close', () => {
      if (!file) return finish(new HttpError(400, 'NO_FILE', 'No file was found in the "file" field.'));
      finish(null, { file, fields });
    });
    req.on('error', () => finish(new HttpError(400, 'UPLOAD_ABORTED', 'The upload was interrupted.')));
    req.pipe(bb);
  });
}
