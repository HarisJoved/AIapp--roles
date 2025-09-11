import uuid
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path

from app.models.document import Document, DocumentStatus, DocumentType, DocumentProcessingStatus, AccessLevel
from app.models.search import SearchRequest, SearchResponse, SearchResult
from app.core.document_processor.langchain_processor import LangChainDocumentProcessor
from app.core.embedders.base import BaseEmbedder
from app.core.vector_db.base import BaseVectorDBClient
from app.config.settings import config_manager


class DocumentService:
    """Service for managing document processing and embedding operations"""
    
    def __init__(self):
        self.documents: Dict[str, Document] = {}
        self.document_processor = None
        self.embedder: Optional[BaseEmbedder] = None
        self.vector_db: Optional[BaseVectorDBClient] = None
        
    def _initialize_processor(self):
        """Initialize document processor with current settings"""
        config = config_manager.get_current_config()
        if config:
            self.document_processor = LangChainDocumentProcessor(
                chunk_size=config.chunk_size,
                chunk_overlap=config.chunk_overlap
            )
        else:
            self.document_processor = LangChainDocumentProcessor()
    
    async def create_document(self, filename: str, file_type: DocumentType, user_id: str, access_level: AccessLevel = AccessLevel.PRIVATE) -> Document:
        """Create a new document record"""
        print(f"🔍 DOCUMENT SERVICE DEBUG: create_document called")
        print(f"🔍 DOCUMENT SERVICE DEBUG: filename={filename}")
        print(f"🔍 DOCUMENT SERVICE DEBUG: file_type={file_type}")
        print(f"🔍 DOCUMENT SERVICE DEBUG: user_id={user_id}")
        print(f"🔍 DOCUMENT SERVICE DEBUG: access_level={access_level}")
        print(f"🔍 DOCUMENT SERVICE DEBUG: access_level type={type(access_level)}")
        print(f"🔍 DOCUMENT SERVICE DEBUG: access_level value={access_level.value if hasattr(access_level, 'value') else access_level}")
        
        document_id = str(uuid.uuid4())
        
        # For organization-level documents, don't assign a user_id
        assigned_user_id = None if access_level == AccessLevel.PUBLIC else user_id
        print(f"🔍 DOCUMENT SERVICE DEBUG: assigned_user_id={assigned_user_id}")
        print(f"🔍 DOCUMENT SERVICE DEBUG: access_level == AccessLevel.PUBLIC: {access_level == AccessLevel.PUBLIC}")
        
        document = Document(
            id=document_id,
            filename=filename,
            file_type=file_type,
            status=DocumentStatus.UPLOADED,
            user_id=assigned_user_id,
            access_level=access_level
        )
        print(f"🔍 DOCUMENT SERVICE DEBUG: Document created with user_id={document.user_id}")
        self.documents[document_id] = document
        return document
    
    async def process_document(self, document_id: str, file_content: bytes) -> bool:
        """Process a document: extract text, clean, and split into chunks"""
        try:
            document = self.documents.get(document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            # Update status to processing
            document.status = DocumentStatus.PROCESSING
            
            # Initialize processor if needed
            if not self.document_processor:
                self._initialize_processor()
            
            # Process the document
            processed_document = await self.document_processor.process_document(document, file_content)
            
            # Update document
            self.documents[document_id] = processed_document
            processed_document.status = DocumentStatus.PROCESSED
            processed_document.processed_at = datetime.utcnow()
            
            return True
            
        except Exception as e:
            # Update status to error
            if document_id in self.documents:
                self.documents[document_id].status = DocumentStatus.ERROR
                self.documents[document_id].error_message = str(e)
            raise e
    
    async def embed_document(self, document_id: str) -> bool:
        """Generate embeddings for document chunks"""
        try:
            document = self.documents.get(document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            if not self.embedder:
                raise ValueError("Embedder not configured")
            
            # Extract text content from chunks
            texts = [chunk.content for chunk in document.chunks]
            if not texts:
                raise ValueError("No chunks to embed")
            
            # Generate embeddings
            embeddings = await self.embedder.embed_texts(texts)
            
            # Update chunks with embeddings
            for i, chunk in enumerate(document.chunks):
                if i < len(embeddings):
                    chunk.embedding = embeddings[i]
            
            document.status = DocumentStatus.EMBEDDED
            return True
            
        except Exception as e:
            # Update status to error
            if document_id in self.documents:
                self.documents[document_id].status = DocumentStatus.ERROR
                self.documents[document_id].error_message = str(e)
            raise e
    
    async def store_vectors(self, document_id: str) -> bool:
        """Store document chunk vectors in vector database"""
        try:
            print(f"🔍 VECTOR STORE DEBUG: Starting store_vectors for {document_id}")
            
            document = self.documents.get(document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            print(f"🔍 VECTOR STORE DEBUG: Document found - user_id={document.user_id}, access_level={document.access_level}")
            
            if not self.vector_db:
                raise ValueError("Vector database not configured")
            
            # Filter chunks that have embeddings
            embedded_chunks = [chunk for chunk in document.chunks if chunk.embedding]
            if not embedded_chunks:
                raise ValueError("No embedded chunks to store")
            
            print(f"🔍 VECTOR STORE DEBUG: Found {len(embedded_chunks)} chunks to store")
            for i, chunk in enumerate(embedded_chunks):
                print(f"🔍 VECTOR STORE DEBUG: Chunk {i}: id={chunk.id}, user_id={chunk.user_id}")
            
            # Store vectors in database
            success = await self.vector_db.batch_upsert_vectors(embedded_chunks)
            if not success:
                raise RuntimeError("Failed to store vectors")
            
            print(f"🔍 VECTOR STORE DEBUG: Vectors stored successfully for {document_id}")
            return True
            
        except Exception as e:
            # Update status to error
            if document_id in self.documents:
                self.documents[document_id].status = DocumentStatus.ERROR
                self.documents[document_id].error_message = str(e)
            raise e
    
    async def process_and_embed_document(self, document_id: str, file_content: bytes) -> bool:
        """Complete document processing pipeline"""
        try:
            print(f"🔍 PROCESS DEBUG: Starting process_and_embed_document for {document_id}")
            
            # Process document
            await self.process_document(document_id, file_content)
            print(f"🔍 PROCESS DEBUG: Document processed successfully for {document_id}")
            
            # Generate embeddings
            await self.embed_document(document_id)
            print(f"🔍 PROCESS DEBUG: Document embedded successfully for {document_id}")
            
            # Store vectors
            await self.store_vectors(document_id)
            print(f"🔍 PROCESS DEBUG: Vectors stored successfully for {document_id}")
            
            return True
            
        except Exception as e:
            print(f"🔍 PROCESS DEBUG: Error in process_and_embed_document: {e}")
            raise e
    
    async def search_documents(self, request: SearchRequest, user_id: str) -> SearchResponse:
        """Search for similar documents"""
        start_time = asyncio.get_event_loop().time()
        
        print(f"🔍 DOCUMENT SEARCH DEBUG: Searching for user_id: {user_id}")
        print(f"🔍 DOCUMENT SEARCH DEBUG: Query: {request.query}")
        print(f"🔍 DOCUMENT SEARCH DEBUG: Top K: {request.top_k}")
        print(f"🔍 DOCUMENT SEARCH DEBUG: Threshold: {request.threshold}")
        
        if not self.embedder:
            raise ValueError("Embedder not configured")
        
        if not self.vector_db:
            raise ValueError("Vector database not configured")
        
        try:
            # Generate query embedding
            print(f"🔍 DOCUMENT SEARCH DEBUG: Generating query embedding...")
            query_embedding = await self.embedder.embed_text(request.query)
            print(f"🔍 DOCUMENT SEARCH DEBUG: Query embedding generated, length: {len(query_embedding)}")
            
            # Search vector database
            print(f"🔍 DOCUMENT SEARCH DEBUG: Searching vector database...")
            results = await self.vector_db.search_vectors(
                query_vector=query_embedding,
                top_k=request.top_k,
                threshold=request.threshold,
                filter_metadata=request.filter_metadata,
                user_id=user_id
            )
            print(f"🔍 DOCUMENT SEARCH DEBUG: Vector search returned {len(results)} results")
            
            execution_time = asyncio.get_event_loop().time() - start_time
            
            return SearchResponse(
                query=request.query,
                results=results,
                total_results=len(results),
                execution_time=execution_time
            )
            
        except Exception as e:
            raise RuntimeError(f"Failed to search documents: {str(e)}")
    
    def get_document(self, document_id: str, user_id: str = None) -> Optional[Document]:
        """Get document by ID, optionally filtered by user"""
        document = self.documents.get(document_id)
        if document and user_id:
            # Allow access if user owns the document OR if it's an organization document (user_id=None)
            if document.user_id != user_id and document.user_id is not None:
                return None
        return document
    
    def get_document_status(self, document_id: str, user_id: str = None) -> Optional[DocumentProcessingStatus]:
        """Get document processing status"""
        document = self.get_document(document_id, user_id)
        if not document:
            return None
        
        embedded_count = sum(1 for chunk in document.chunks if chunk.embedding)
        progress = 0.0
        
        if document.status == DocumentStatus.UPLOADED:
            progress = 0.0
        elif document.status == DocumentStatus.PROCESSING:
            progress = 25.0
        elif document.status == DocumentStatus.PROCESSED:
            progress = 50.0
        elif document.status == DocumentStatus.EMBEDDED:
            progress = 100.0
        elif document.status == DocumentStatus.ERROR:
            progress = 0.0
        
        return DocumentProcessingStatus(
            document_id=document_id,
            status=document.status,
            chunks_count=len(document.chunks),
            embedded_count=embedded_count,
            error_message=document.error_message,
            progress_percentage=progress
        )
    
    async def list_documents(self, user_id: str = None) -> List[Document]:
        """List documents, optionally filtered by user"""
        print(f"🔍 LIST DEBUG: list_documents called with user_id: {user_id}")
        print(f"🔍 LIST DEBUG: Total documents in memory: {len(self.documents)}")
        
        if user_id:
            # Get documents from memory first
            user_docs = [doc for doc in self.documents.values() if doc.user_id == user_id]
            org_docs = [doc for doc in self.documents.values() if doc.user_id is None]
            
            # Also get ALL documents from Pinecone (both user and organization docs)
            if self.vector_db:
                try:
                    pinecone_docs = await self.vector_db.get_all_documents()
                    print(f"🔍 LIST DEBUG: Found {len(pinecone_docs)} documents in Pinecone")
                    
                    # Process all documents from Pinecone
                    for pinecone_doc in pinecone_docs:
                        filename = pinecone_doc.get("filename")
                        doc_user_id = pinecone_doc.get("user_id")
                        
                        # Check if we already have this document in memory
                        already_exists = any(doc.filename == filename for doc in user_docs + org_docs)
                        
                        if not already_exists:
                            # Determine access level based on user_id
                            if doc_user_id is None:
                                # Organization document
                                access_level = AccessLevel.PUBLIC
                                doc_user_id = None
                            else:
                                # Private document - only include if it belongs to the current user
                                if doc_user_id == user_id:
                                    access_level = AccessLevel.PRIVATE
                                else:
                                    continue  # Skip documents belonging to other users
                            
                            # Create a Document object
                            document = Document(
                                id=f"pinecone_{filename}",  # Generate a unique ID
                                filename=filename,
                                file_type=DocumentType(pinecone_doc.get("file_type", "txt")),
                                status=DocumentStatus.EMBEDDED,
                                user_id=doc_user_id,
                                access_level=access_level,
                                chunks=[]  # We don't have chunk details from Pinecone
                            )
                            
                            if doc_user_id is None:
                                org_docs.append(document)
                                print(f"🔍 LIST DEBUG: Added organization document from Pinecone: {filename}")
                            else:
                                user_docs.append(document)
                                print(f"🔍 LIST DEBUG: Added user document from Pinecone: {filename}")
                except Exception as e:
                    print(f"🔍 LIST DEBUG: Error getting documents from Pinecone: {e}")
            
            all_docs = user_docs + org_docs
            
            print(f"🔍 LIST DEBUG: User documents: {len(user_docs)}")
            print(f"🔍 LIST DEBUG: Organization documents: {len(org_docs)}")
            print(f"🔍 LIST DEBUG: Total accessible documents: {len(all_docs)}")
            
            for doc in all_docs:
                print(f"🔍 LIST DEBUG: Document: {doc.filename}, user_id: {doc.user_id}, access_level: {doc.access_level}")
            
            return all_docs
        return list(self.documents.values())
    
    async def delete_document(self, document_id: str, user_id: str = None) -> bool:
        """Delete document and its vectors"""
        try:
            document = self.get_document(document_id, user_id)
            if not document:
                return False
            
            # Delete vectors from vector database if configured
            if self.vector_db and document.chunks:
                chunk_ids = [chunk.id for chunk in document.chunks]
                await self.vector_db.delete_vectors(chunk_ids)
            
            # Remove from memory
            del self.documents[document_id]
            return True
            
        except Exception as e:
            raise RuntimeError(f"Failed to delete document: {str(e)}")
    
    def set_embedder(self, embedder: BaseEmbedder):
        """Set the embedder instance"""
        self.embedder = embedder
    
    def set_vector_db(self, vector_db: BaseVectorDBClient):
        """Set the vector database instance"""
        self.vector_db = vector_db
    
    async def can_access_document(self, document_id: str, user_id: str) -> bool:
        """Check if user can access document"""
        document = self.get_document(document_id)
        if not document:
            return False
        
        # Document owner can always access
        if document.user_id == user_id:
            return True
        
        # Use user management service for hierarchy-based access control
        try:
            from app.services.user_management_service import get_user_management_service
            user_service = get_user_management_service()
            return await user_service.can_access_document(user_id, document.dict())
        except:
            return False
    
    def list_accessible_documents(self, user_id: str) -> List[Document]:
        """List documents accessible to user (simplified version)"""
        accessible = []
        for doc in self.documents.values():
            if doc.user_id == user_id or doc.access_level == AccessLevel.PUBLIC:
                accessible.append(doc)
        return accessible


# Global document service instance
document_service = DocumentService() 