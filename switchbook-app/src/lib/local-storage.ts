import { writeFile, unlink, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.NODE_ENV === 'production' 
  ? '/app/public/uploads' 
  : path.join(process.cwd(), 'public', 'uploads')

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch (error) {
    console.error('Error creating upload directory:', error)
  }
}

export async function uploadFile(
  file: File,
  folder: string = ''
): Promise<{ url: string; pathname: string }> {
  await ensureUploadDir()
  
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  // Generate unique filename
  const extension = path.extname(file.name)
  const filename = `${randomUUID()}${extension}`
  const filepath = folder ? path.join(folder, filename) : filename
  const fullPath = path.join(UPLOAD_DIR, filepath)
  
  // Ensure subdirectory exists if specified
  if (folder) {
    await mkdir(path.join(UPLOAD_DIR, folder), { recursive: true })
  }
  
  // Write file
  await writeFile(fullPath, buffer)
  
  // Return URL path that will be served by nginx
  const url = `/uploads/${filepath}`
  
  return { url, pathname: filepath }
}

export async function deleteFile(pathname: string): Promise<void> {
  try {
    const fullPath = path.join(UPLOAD_DIR, pathname)
    await unlink(fullPath)
  } catch (error) {
    console.error('Error deleting file:', error)
    // Don't throw - file might already be deleted
  }
}

export function getFileUrl(pathname: string): string {
  return `/uploads/${pathname}`
}