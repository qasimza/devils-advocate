import os
import io
from google.cloud import storage
from google.oauth2 import service_account
from pypdf import PdfReader

KEY_PATH = os.getenv("FIREBASE_KEY_PATH", "/secrets/firebase_key.json")
BUCKET_NAME = os.getenv("FIREBASE_STORAGE_BUCKET", "devils-advocate-ec48b.firebasestorage.app")

def _get_client():
    creds = service_account.Credentials.from_service_account_file(KEY_PATH)
    return storage.Client(credentials=creds, project=creds.project_id)

def _extract_text(blob_bytes: bytes, filename: str) -> str:
    """Extract plain text from PDF or txt bytes."""
    if filename.lower().endswith('.pdf'):
        try:
            
            reader = PdfReader(io.BytesIO(blob_bytes))
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages).strip()
        except Exception as e:
            print(f"PDF extraction error for {filename}: {e}")
            return ""
    else:
        # Plain text
        try:
            return blob_bytes.decode('utf-8', errors='ignore').strip()
        except Exception:
            return ""

def download_and_extract(document_paths: list[str]) -> tuple[list[str], list[dict]]:
    """
    Download files from Firebase Storage and extract text.
    Returns (texts, metadatas) ready for chroma ingest.
    """
    if not document_paths:
        return [], []

    client = _get_client()
    bucket = client.bucket(BUCKET_NAME)

    texts = []
    metadatas = []

    for path in document_paths:
        try:
            blob = bucket.blob(path)
            blob_bytes = blob.download_as_bytes()
            filename = path.split('/')[-1]

            # Strip timestamp prefix (e.g. "1234567890_pitch.pdf" → "pitch.pdf")
            display_name = '_'.join(filename.split('_')[1:]) if '_' in filename else filename

            text = _extract_text(blob_bytes, filename)
            if not text:
                print(f"[Storage] No text extracted from {filename}, skipping")
                continue

            # Chunk into ~300 word segments same as base knowledge
            words = text.split()
            chunks = [" ".join(words[i:i+300]) for i in range(0, len(words), 250)]
            for chunk in chunks:
                if chunk and isinstance(chunk, str) and chunk.strip():
                    texts.append(chunk.strip())
                    metadatas.append({
                        "source": display_name,
                        "type": "user_upload"
                    })

            print(f"[Storage] Extracted {len(chunks)} chunks from {display_name}")

        except Exception as e:
            print(f"[Storage] Failed to process {path}: {e}")
            continue

    print(f"[Storage DEBUG] returning {len(texts)} texts, types: {list(set(type(t).__name__ for t in texts))}")
    return texts, metadatas


def delete_user_files(uid: str) -> None:
    """Delete all files for a user — called at session end for anonymous users."""
    try:
        client = _get_client()
        bucket = client.bucket(BUCKET_NAME)
        prefix = f"users/{uid}/documents/"
        blobs = list(bucket.list_blobs(prefix=prefix))
        if not blobs:
            return
        for blob in blobs:
            blob.delete()
        print(f"[Storage] Deleted {len(blobs)} files for uid {uid}")
    except Exception as e:
        print(f"[Storage] Deletion error for uid {uid}: {e}")