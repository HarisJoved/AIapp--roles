import asyncio
from typing import List, Dict, Any, Optional
from pinecone import Pinecone, ServerlessSpec

from app.models.config import PineconeDBConfig
from app.models.document import DocumentChunk
from app.models.search import SearchResult
from .base import BaseVectorDBClient


class PineconeClient(BaseVectorDBClient):
    """Pinecone vector database client"""
    
    def __init__(self, config: PineconeDBConfig):
        super().__init__()
        self.config = config
        self.pc = Pinecone(api_key=config.api_key)
        self.index_name = config.index_name
        self.dimension = config.dimension
        self.metric = config.metric
        self.index = None
    
    async def initialize(self) -> bool:
        """Initialize Pinecone connection and create index if needed"""
        try:
            # Check if index exists
            existing_indexes = self.pc.list_indexes()
            index_names = [idx['name'] for idx in existing_indexes.get('indexes', [])]
            
            if self.index_name not in index_names:
                # Create index if it doesn't exist
                await self.create_collection(self.dimension, self.metric)
            
            # Connect to index
            self.index = self.pc.Index(self.index_name)
            return True
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Pinecone: {str(e)}")
    
    async def health_check(self) -> bool:
        """Check if Pinecone is accessible"""
        try:
            if not self.index:
                await self.initialize()
            
            # Try to get index stats
            stats = self.index.describe_index_stats()
            return True
        except Exception:
            return False
    
    async def create_collection(self, dimension: int, metric: str = "cosine") -> bool:
        """Create a new Pinecone index"""
        try:
            self.pc.create_index(
                name=self.index_name,
                dimension=dimension,
                metric=metric,
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"  # Adjust as needed
                )
            )
            
            # Wait for index to be ready
            import time
            while True:
                try:
                    desc = self.pc.describe_index(self.index_name)
                    if desc['status']['ready']:
                        break
                    time.sleep(1)
                except:
                    time.sleep(1)
            
            return True
        except Exception as e:
            raise RuntimeError(f"Failed to create Pinecone index: {str(e)}")
    
    async def delete_collection(self) -> bool:
        """Delete the Pinecone index"""
        try:
            self.pc.delete_index(self.index_name)
            return True
        except Exception as e:
            raise RuntimeError(f"Failed to delete Pinecone index: {str(e)}")
    
    async def upsert_vectors(self, chunks: List[DocumentChunk]) -> bool:
        """Upsert vectors to Pinecone"""
        try:
            print(f"🔍 PINECONE DEBUG: Starting upsert_vectors with {len(chunks)} chunks")
            
            if not self.index:
                await self.initialize()
            
            # Prepare vectors for upsert
            vectors = []
            for i, chunk in enumerate(chunks):
                if chunk.embedding:
                    print(f"🔍 PINECONE DEBUG: Processing chunk {i}: id={chunk.id}, user_id={chunk.user_id}")
                    
                    metadata = {
                        **chunk.metadata,
                        "content": chunk.content[:1000],  # Limit content size
                    }
                    
                    # Only add user_id if it exists (for private documents)
                    if chunk.user_id:
                        metadata["user_id"] = chunk.user_id
                        print(f"🔍 PINECONE DEBUG: Added user_id to metadata: {chunk.user_id}")
                    else:
                        print(f"🔍 PINECONE DEBUG: No user_id for this chunk (organization document)")
                    
                    vector_data = {
                        "id": chunk.id,
                        "values": chunk.embedding,
                        "metadata": metadata
                    }
                    
                    print(f"🔍 PINECONE DEBUG: Final vector metadata: {metadata}")
                    vectors.append(vector_data)
            
            if vectors:
                print(f"🔍 PINECONE DEBUG: Upserting {len(vectors)} vectors to Pinecone")
                await asyncio.to_thread(self.index.upsert, vectors=vectors)
                print(f"🔍 PINECONE DEBUG: Successfully upserted vectors to Pinecone")
            else:
                print(f"🔍 PINECONE DEBUG: No vectors to upsert")
            
            return True
        except Exception as e:
            raise RuntimeError(f"Failed to upsert vectors to Pinecone: {str(e)}")
    
    async def search_vectors(
        self, 
        query_vector: List[float], 
        top_k: int = 5, 
        threshold: float = 0.0,
        filter_metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ) -> List[SearchResult]:
        """Search for similar vectors in Pinecone"""
        try:
            if not self.index:
                await self.initialize()
            
            # Build filter for user_id
            search_filter = filter_metadata or {}
            if user_id:
                # Include both user's private documents and organization documents (no user_id)
                # Pinecone doesn't support OR conditions directly, so we'll handle this in post-processing
                # For now, we'll search without user_id filter and filter in the application
                pass  # Don't add user_id filter here
            
            # Perform search (run in thread to avoid blocking event loop)
            results = await asyncio.to_thread(
                self.index.query,
                vector=query_vector,
                top_k=top_k,
                include_metadata=True,
                filter=search_filter
            )
            
            # Convert to SearchResult objects and filter by user access
            search_results = []
            print(f"🔍 SEARCH DEBUG: Found {len(results.matches)} matches from Pinecone")
            
            for i, match in enumerate(results.matches):
                print(f"🔍 SEARCH DEBUG: Match {i}: score={match.score}, metadata={match.metadata}")
                
                if match.score >= threshold:
                    metadata = match.metadata or {}
                    doc_user_id = metadata.get("user_id")
                    
                    print(f"🔍 SEARCH DEBUG: Processing match - doc_user_id: {doc_user_id}, user_id: {user_id}")
                    
                    # Apply user access filtering
                    if user_id:
                        # Include documents that either:
                        # 1. Belong to the user (have user_id matching)
                        # 2. Are organization-wide (no user_id in metadata)
                        if doc_user_id and doc_user_id != user_id:
                            print(f"🔍 SEARCH DEBUG: Skipping document belonging to other user: {doc_user_id}")
                            continue  # Skip documents belonging to other users
                        else:
                            print(f"🔍 SEARCH DEBUG: Including document - user match or organization doc")
                    else:
                        print(f"🔍 SEARCH DEBUG: Including document - no user filter")
                    
                    search_results.append(SearchResult(
                        chunk_id=match.id,
                        document_id=metadata.get("filename", "unknown"),
                        content=metadata.get("content", ""),
                        score=match.score,
                        metadata=metadata
                    ))
                    print(f"🔍 SEARCH DEBUG: Added search result for document: {metadata.get('filename', 'unknown')}")
            
            print(f"🔍 SEARCH DEBUG: Returning {len(search_results)} search results")
            
            return search_results
        except Exception as e:
            raise RuntimeError(f"Failed to search vectors in Pinecone: {str(e)}")
    
    async def get_all_documents(self) -> List[Dict[str, Any]]:
        """Get all unique documents from Pinecone"""
        try:
            if not self.index:
                await self.initialize()
            
            # Get all vectors (this might be expensive for large indexes)
            # For now, we'll use a dummy query to get all vectors
            dummy_vector = [0.0] * self.dimension  # Create a dummy vector
            
            results = await asyncio.to_thread(
                self.index.query,
                vector=dummy_vector,
                top_k=10000,  # Get a large number of results
                include_metadata=True,
                include_values=False
            )
            
            # Extract unique documents
            documents = {}
            for match in results.matches:
                metadata = match.metadata or {}
                filename = metadata.get("filename", "unknown")
                if filename not in documents:
                    documents[filename] = {
                        "filename": filename,
                        "file_type": metadata.get("file_type", "unknown"),
                        "user_id": metadata.get("user_id"),  # None for organization docs
                        "chunk_count": 0
                    }
                documents[filename]["chunk_count"] += 1
            
            return list(documents.values())
            
        except Exception as e:
            print(f"🔍 PINECONE DEBUG: Error getting all documents: {e}")
            return []
    
    async def delete_vectors(self, chunk_ids: List[str]) -> bool:
        """Delete vectors from Pinecone"""
        try:
            if not self.index:
                await self.initialize()
            
            await asyncio.to_thread(self.index.delete, ids=chunk_ids)
            return True
        except Exception as e:
            raise RuntimeError(f"Failed to delete vectors from Pinecone: {str(e)}")
    
    async def get_collection_stats(self) -> Dict[str, Any]:
        """Get Pinecone index statistics"""
        try:
            if not self.index:
                await self.initialize()
            
            stats = await asyncio.to_thread(self.index.describe_index_stats)
            return {
                "total_vectors": stats.total_vector_count,
                "dimension": stats.dimension,
                "index_fullness": stats.index_fullness,
                "namespaces": stats.namespaces
            }
        except Exception as e:
            raise RuntimeError(f"Failed to get Pinecone stats: {str(e)}") 