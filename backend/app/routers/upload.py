import os
import asyncio
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends, Form
from fastapi.responses import JSONResponse

from app.models.document import DocumentType, DocumentUploadResponse, DocumentProcessingStatus, AccessLevel
from app.models.search import SearchRequest, SearchResponse
from app.services.document_service import document_service
from app.config.settings import settings
from app.services.auth_service import get_current_user
from app.models.auth import User as KeycloakUser


router = APIRouter(prefix="/upload", tags=["upload"])


def get_document_type(filename: str) -> DocumentType:
    """Determine document type from filename"""
    extension = filename.lower().split('.')[-1]
    type_mapping = {
        'pdf': DocumentType.PDF,
        'docx': DocumentType.DOCX,
        'txt': DocumentType.TXT,
        'html': DocumentType.HTML,
        'md': DocumentType.MARKDOWN,
        'markdown': DocumentType.MARKDOWN,
        'pptx': DocumentType.PPTX,
        'xlsx': DocumentType.XLSX,
        'xls': DocumentType.XLS
    }
    
    if extension not in type_mapping:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {extension}")
    
    return type_mapping[extension]


async def process_document_background(document_id: str, file_content: bytes):
    """Background task for processing documents"""
    try:
        await document_service.process_and_embed_document(document_id, file_content)
    except Exception as e:
        print(f"Error processing document {document_id}: {e}")


@router.post("/", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    access_level: str = Form("private"),
    current_user: KeycloakUser = Depends(get_current_user)
):
    """Upload and process a document"""
    try:
        print(f"🔍 UPLOAD DEBUG: Received upload request")
        print(f"🔍 UPLOAD DEBUG: File: {file.filename}")
        print(f"🔍 UPLOAD DEBUG: Access Level String: {access_level}")
        print(f"🔍 UPLOAD DEBUG: Current User ID: {current_user.user_id}")
        print(f"🔍 UPLOAD DEBUG: Access Level Type: {type(access_level)}")
        
        # Convert string to AccessLevel enum
        try:
            access_level_enum = AccessLevel(access_level)
            print(f"🔍 UPLOAD DEBUG: Converted to AccessLevel: {access_level_enum}")
        except ValueError:
            print(f"🔍 UPLOAD DEBUG: Invalid access level '{access_level}', defaulting to PRIVATE")
            access_level_enum = AccessLevel.PRIVATE
        
        # Validate file size
        file_content = await file.read()
        if len(file_content) > settings.max_file_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {settings.max_file_size} bytes"
            )
        
        # Determine file type
        file_type = get_document_type(file.filename)
        print(f"🔍 UPLOAD DEBUG: File Type: {file_type}")
        
        # Create document record
        print(f"🔍 UPLOAD DEBUG: Creating document with user_id={current_user.user_id}, access_level={access_level_enum}")
        document = await document_service.create_document(file.filename, file_type, current_user.user_id, access_level_enum)
        print(f"🔍 UPLOAD DEBUG: Document created with ID: {document.id}")
        print(f"🔍 UPLOAD DEBUG: Document user_id: {document.user_id}")
        print(f"🔍 UPLOAD DEBUG: Document access_level: {document.access_level}")
        
        # Start background processing
        background_tasks.add_task(process_document_background, document.id, file_content)
        
        return DocumentUploadResponse(
            document_id=document.id,
            status=document.status,
            message=f"Document '{file.filename}' uploaded successfully. Processing started."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")


@router.get("/status/{document_id}", response_model=DocumentProcessingStatus)
async def get_document_status(document_id: str, current_user: KeycloakUser = Depends(get_current_user)):
    """Get document processing status"""
    try:
        status = document_service.get_document_status(document_id, current_user.user_id)
        if not status:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get document status: {str(e)}")


@router.get("/list")
async def list_documents(current_user: KeycloakUser = Depends(get_current_user)):
    """List user's documents"""
    try:
        documents = await document_service.list_documents(current_user.user_id)
        return {
            "documents": [
                {
                    "id": doc.id,
                    "filename": doc.filename,
                    "file_type": doc.file_type,
                    "status": doc.status,
                    "created_at": doc.created_at,
                    "processed_at": doc.processed_at,
                    "chunks_count": len(doc.chunks),
                    "error_message": doc.error_message
                }
                for doc in documents
            ],
            "total": len(documents)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")


@router.delete("/{document_id}")
async def delete_document(document_id: str, current_user: KeycloakUser = Depends(get_current_user)):
    """Delete a document and its vectors"""
    try:
        success = await document_service.delete_document(document_id, current_user.user_id)
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {"message": f"Document {document_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")


@router.post("/search", response_model=SearchResponse)
async def search_documents(request: SearchRequest, current_user: KeycloakUser = Depends(get_current_user)):
    """Search for similar documents"""
    try:
        response = await document_service.search_documents(request, current_user.user_id)
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search documents: {str(e)}") 