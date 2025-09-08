#!/usr/bin/env python3
"""
Test script to verify user-specific document isolation in vector databases.
"""

import asyncio
import uuid
from typing import List

from app.models.document import Document, DocumentChunk, DocumentType, DocumentStatus
from app.services.document_service import DocumentService
from app.core.vector_db.chromadb_client import ChromaDBClient
from app.core.embedders.huggingface_embedder import HuggingFaceEmbedder
from app.models.config import ChromaDBConfig, HuggingFaceEmbedderConfig


async def test_user_isolation():
    """Test that users can only access their own documents"""
    
    print("🧪 Testing user-specific document isolation...")
    
    # Create test users
    user1_id = "user1"
    user2_id = "user2"
    
    # Initialize services
    document_service = DocumentService()
    
    # Create a simple embedder for testing
    embedder_config = HuggingFaceEmbedderConfig(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
    embedder = HuggingFaceEmbedder(embedder_config)
    document_service.set_embedder(embedder)
    
    # Create ChromaDB client
    chromadb_config = ChromaDBConfig(
        collection_name="test_user_isolation",
        persist_directory="./test_chroma_data"
    )
    vector_db = ChromaDBClient(chromadb_config)
    await vector_db.initialize()
    document_service.set_vector_db(vector_db)
    
    print("✅ Services initialized")
    
    # Create test documents for user1
    doc1 = await document_service.create_document("user1_doc1.txt", DocumentType.TXT, user1_id)
    doc2 = await document_service.create_document("user1_doc2.txt", DocumentType.TXT, user1_id)
    
    # Create test documents for user2
    doc3 = await document_service.create_document("user2_doc1.txt", DocumentType.TXT, user2_id)
    doc4 = await document_service.create_document("user2_doc2.txt", DocumentType.TXT, user2_id)
    
    print(f"✅ Created documents: {doc1.id}, {doc2.id}, {doc3.id}, {doc4.id}")
    
    # Create test chunks with embeddings
    chunk1 = DocumentChunk(
        id=str(uuid.uuid4()),
        content="This is user1's first document about machine learning.",
        metadata={"source": "user1_doc1.txt"},
        user_id=user1_id
    )
    
    chunk2 = DocumentChunk(
        id=str(uuid.uuid4()),
        content="This is user1's second document about artificial intelligence.",
        metadata={"source": "user1_doc2.txt"},
        user_id=user1_id
    )
    
    chunk3 = DocumentChunk(
        id=str(uuid.uuid4()),
        content="This is user2's first document about data science.",
        metadata={"source": "user2_doc1.txt"},
        user_id=user2_id
    )
    
    chunk4 = DocumentChunk(
        id=str(uuid.uuid4()),
        content="This is user2's second document about deep learning.",
        metadata={"source": "user2_doc2.txt"},
        user_id=user2_id
    )
    
    # Generate embeddings
    texts = [chunk1.content, chunk2.content, chunk3.content, chunk4.content]
    embeddings = await embedder.embed_texts(texts)
    
    chunk1.embedding = embeddings[0]
    chunk2.embedding = embeddings[1]
    chunk3.embedding = embeddings[2]
    chunk4.embedding = embeddings[3]
    
    print("✅ Generated embeddings")
    
    # Store all chunks in vector database
    await vector_db.upsert_vectors([chunk1, chunk2, chunk3, chunk4])
    print("✅ Stored chunks in vector database")
    
    # Test search for user1 - should only find user1's documents
    print("\n🔍 Testing search for user1...")
    query_embedding = await embedder.embed_text("machine learning artificial intelligence")
    results_user1 = await vector_db.search_vectors(
        query_vector=query_embedding,
        top_k=10,
        user_id=user1_id
    )
    
    print(f"User1 search results: {len(results_user1)} documents found")
    for i, result in enumerate(results_user1):
        print(f"  {i+1}. Score: {result.score:.3f}, Content: {result.content[:50]}...")
        # Verify all results belong to user1
        assert result.metadata.get("user_id") == user1_id, f"Result {i+1} belongs to wrong user!"
    
    # Test search for user2 - should only find user2's documents
    print("\n🔍 Testing search for user2...")
    results_user2 = await vector_db.search_vectors(
        query_vector=query_embedding,
        top_k=10,
        user_id=user2_id
    )
    
    print(f"User2 search results: {len(results_user2)} documents found")
    for i, result in enumerate(results_user2):
        print(f"  {i+1}. Score: {result.score:.3f}, Content: {result.content[:50]}...")
        # Verify all results belong to user2
        assert result.metadata.get("user_id") == user2_id, f"Result {i+1} belongs to wrong user!"
    
    # Test search without user filter - should find all documents
    print("\n🔍 Testing search without user filter...")
    results_all = await vector_db.search_vectors(
        query_vector=query_embedding,
        top_k=10
    )
    
    print(f"Unfiltered search results: {len(results_all)} documents found")
    for i, result in enumerate(results_all):
        print(f"  {i+1}. Score: {result.score:.3f}, User: {result.metadata.get('user_id')}, Content: {result.content[:50]}...")
    
    # Test document service user filtering
    print("\n🔍 Testing document service user filtering...")
    
    # List documents for user1
    user1_docs = document_service.list_documents(user1_id)
    print(f"User1 documents: {len(user1_docs)}")
    for doc in user1_docs:
        print(f"  - {doc.filename} (ID: {doc.id})")
        assert doc.user_id == user1_id, f"Document {doc.id} belongs to wrong user!"
    
    # List documents for user2
    user2_docs = document_service.list_documents(user2_id)
    print(f"User2 documents: {len(user2_docs)}")
    for doc in user2_docs:
        print(f"  - {doc.filename} (ID: {doc.id})")
        assert doc.user_id == user2_id, f"Document {doc.id} belongs to wrong user!"
    
    # Test that user1 cannot access user2's documents
    user1_trying_user2_doc = document_service.get_document(doc3.id, user1_id)
    assert user1_trying_user2_doc is None, "User1 should not be able to access user2's document!"
    print("✅ User1 cannot access user2's documents")
    
    # Test that user2 cannot access user1's documents
    user2_trying_user1_doc = document_service.get_document(doc1.id, user2_id)
    assert user2_trying_user1_doc is None, "User2 should not be able to access user1's document!"
    print("✅ User2 cannot access user1's documents")
    
    print("\n🎉 All user isolation tests passed!")
    
    # Cleanup
    await vector_db.delete_collection()
    print("🧹 Cleaned up test data")


if __name__ == "__main__":
    asyncio.run(test_user_isolation())
