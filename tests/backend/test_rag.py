# tests/backend/test_rag.py
import pytest
from rag.chroma_backend import ChromaBackend

@pytest.fixture
def backend():
    # ChromaBackend uses EphemeralClient — safe to instantiate in tests
    return ChromaBackend()

class TestIngestAndRetrieve:
    def test_retrieves_relevant_chunk(self, backend):
        backend.ingest_documents(
            "user_test_1",
            texts=["Our CAC payback period is 8 months for SMB customers"],
            metadatas=[{"source": "test.txt", "type": "user_upload"}]
        )
        result = backend.retrieve("user_test_1", "CAC payback period", n_results=1)
        assert "CAC" in result

    def test_retrieves_base_knowledge(self, backend):
        # Base knowledge is loaded on import — should be retrievable
        backend.ingest_documents("user_test_2", texts=[], metadatas=[])
        result = backend.retrieve("user_test_2", "SaaS churn rate benchmarks", n_results=2)
        assert len(result) > 0

    def test_returns_empty_string_when_no_collection(self, backend):
        # New participant with no documents yet — should not crash
        result = backend.retrieve("nonexistent_user_999", "anything", n_results=3)
        # Either empty string or raises — test that it handles gracefully
        assert isinstance(result, str)

class TestDeleteParticipant:
    def test_delete_removes_collection(self, backend):
        backend.ingest_documents(
            "user_to_delete",
            texts=["some content"],
            metadatas=[{"source": "test.txt", "type": "user_upload"}]
        )
        backend.delete_participant("user_to_delete")
        # Should not raise on second delete
        backend.delete_participant("user_to_delete")

    def test_delete_nonexistent_does_not_raise(self, backend):
        backend.delete_participant("never_existed_999")