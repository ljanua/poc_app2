'use strict';

const Busboy = require('busboy');

function readMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    const busboy = Busboy({ headers: req.headers });

    busboy.on('field', (name, value) => {
      if (fields[name] === undefined) {
        fields[name] = value;
        return;
      }
      if (Array.isArray(fields[name])) {
        fields[name].push(value);
      } else {
        fields[name] = [fields[name], value];
      }
    });

    busboy.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        files.push({
          field: name,
          filename: info.filename,
          mimeType: info.mimeType,
          buffer: Buffer.concat(chunks)
        });
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => resolve({ fields, files }));
    req.pipe(busboy);
  });
}

function parseSkillFocusField(raw) {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry).trim()).filter(Boolean);
  }
  const text = String(raw).trim();
  if (!text) {
    return [];
  }
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry).trim()).filter(Boolean);
    }
  } catch (error) {
    // Fall through to comma-separated parsing.
  }
  return text.split(',').map((entry) => entry.trim()).filter(Boolean);
}

module.exports = {
  readMultipartForm,
  parseSkillFocusField
};
