from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class DocumentType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    HTML = "html"
    MARKDOWN = "markdown"
    PPTX = "pptx"
    XLSX = "xlsx"
    XLS = "xls"


class DocumentStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    EMBEDDED = "embedded"
    ERROR = "error"


class DocumentChunk(BaseModel):
    id: str = Field(..., description="Unique chunk ID")
    content: str = Field(..., description="Chunk text content")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Chunk metadata")
    embedding: Optional[List[float]] = Field(None, description="Vector embedding")
    user_id: Optional[str] = Field(None, description="ID of the user who owns this chunk (None for organization documents)")
    
    
class AccessLevel(str, Enum):
    """Document access levels"""
    PRIVATE = "private"  # Only uploader can access
    HIERARCHY = "hierarchy"  # Accessible to users under uploader in hierarchy
    PUBLIC = "public"  # Accessible to all users in same organization


class Document(BaseModel):
    id: str = Field(..., description="Unique document ID")
    filename: str = Field(..., description="Original filename")
    file_type: DocumentType = Field(..., description="Document type")
    content: Optional[str] = Field(None, description="Full document content")
    chunks: List[DocumentChunk] = Field(default_factory=list, description="Document chunks")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")
    status: DocumentStatus = Field(default=DocumentStatus.UPLOADED, description="Processing status")
    user_id: Optional[str] = Field(None, description="ID of the user who uploaded the document (None for organization documents)")
    
    # Access control
    access_level: AccessLevel = Field(default=AccessLevel.PRIVATE, description="Document access level")
    accessible_to: List[str] = Field(default_factory=list, description="Specific user IDs with access")
    organization_id: Optional[str] = Field(None, description="Organization ID for access control")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    processed_at: Optional[datetime] = Field(None, description="Processing completion timestamp")
    error_message: Optional[str] = Field(None, description="Error message if processing failed")


class DocumentUploadRequest(BaseModel):
    filename: str = Field(..., description="Document filename")
    file_type: DocumentType = Field(..., description="Document type")


class DocumentUploadResponse(BaseModel):
    document_id: str = Field(..., description="Created document ID")
    status: DocumentStatus = Field(..., description="Document status")
    message: str = Field(..., description="Status message")


class DocumentProcessingStatus(BaseModel):
    document_id: str = Field(..., description="Document ID")
    status: DocumentStatus = Field(..., description="Current status")
    chunks_count: int = Field(default=0, description="Number of chunks created")
    embedded_count: int = Field(default=0, description="Number of chunks embedded")
    error_message: Optional[str] = Field(None, description="Error message if any")
    progress_percentage: float = Field(default=0.0, description="Processing progress percentage") 