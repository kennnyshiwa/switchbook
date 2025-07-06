#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

const prisma = new PrismaClient();

// Configuration
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || './public/uploads';
const BATCH_SIZE = 10; // Process images in batches to avoid overwhelming the system

// Ensure download directory exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Function to download a file
async function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', reject);
  });
}

// Function to get file extension from URL
function getFileExtension(url) {
  // Extract filename from URL
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1].split('?')[0];
  const ext = path.extname(filename);
  return ext || '.jpg'; // Default to .jpg if no extension found
}

// Function to generate unique filename
function generateFilename(switchId, imageId, extension) {
  return `switch_${switchId}_${imageId}${extension}`;
}

async function migrateImages() {
  console.log('🚀 Starting Vercel Blob image migration...');
  
  try {
    // Get all switches with Vercel Blob URLs
    const switches = await prisma.switch.findMany({
      where: {
        imageUrl: {
          contains: '.vercel-storage.com'
        }
      },
      select: {
        id: true,
        imageUrl: true,
        name: true,
        userId: true
      }
    });
    
    console.log(`📊 Found ${switches.length} switches with Vercel Blob images`);
    
    // Process in batches
    for (let i = 0; i < switches.length; i += BATCH_SIZE) {
      const batch = switches.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(switches.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (switchItem) => {
        try {
          // Generate filename
          const extension = getFileExtension(switchItem.imageUrl);
          const filename = generateFilename(switchItem.id, Date.now(), extension);
          const filepath = path.join(DOWNLOAD_DIR, filename);
          
          console.log(`⬇️  Downloading image for switch "${switchItem.name}" (${switchItem.id})`);
          
          // Download the image
          await downloadFile(switchItem.imageUrl, filepath);
          
          // Update the switch with new local path
          const newImageUrl = `/uploads/${filename}`;
          await prisma.switch.update({
            where: { id: switchItem.id },
            data: { imageUrl: newImageUrl }
          });
          
          console.log(`✅ Migrated image for switch "${switchItem.name}"`);
        } catch (error) {
          console.error(`❌ Failed to migrate image for switch "${switchItem.name}": ${error.message}`);
        }
      }));
    }
    
    // Also check SwitchImage table for Vercel Blob URLs
    console.log('\n🔍 Checking SwitchImage table...');
    
    const switchImages = await prisma.switchImage.findMany({
      where: {
        url: {
          contains: '.vercel-storage.com'
        }
      }
    });
    
    console.log(`📊 Found ${switchImages.length} images in SwitchImage table`);
    
    // Process SwitchImage entries
    for (let i = 0; i < switchImages.length; i += BATCH_SIZE) {
      const batch = switchImages.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing SwitchImage batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(switchImages.length/BATCH_SIZE)}`);
      
      await Promise.all(batch.map(async (image) => {
        try {
          const extension = getFileExtension(image.url);
          const filename = generateFilename(image.switchId, image.id, extension);
          const filepath = path.join(DOWNLOAD_DIR, filename);
          
          console.log(`⬇️  Downloading SwitchImage ${image.id}`);
          
          await downloadFile(image.url, filepath);
          
          // Update URL field
          const newUrl = `/uploads/${filename}`;
          await prisma.switchImage.update({
            where: { id: image.id },
            data: {
              url: newUrl
            }
          });
          
          console.log(`✅ Migrated SwitchImage ${image.id}`);
        } catch (error) {
          console.error(`❌ Failed to migrate SwitchImage ${image.id}: ${error.message}`);
        }
      }));
    }
    
    // Check master switches
    console.log('\n🔍 Checking MasterSwitch table...');
    
    const masterSwitches = await prisma.masterSwitch.findMany({
      where: {
        imageUrl: {
          contains: '.vercel-storage.com'
        }
      },
      select: {
        id: true,
        imageUrl: true,
        name: true
      }
    });
    
    console.log(`📊 Found ${masterSwitches.length} master switches with Vercel Blob images`);
    
    // Process master switches
    for (let i = 0; i < masterSwitches.length; i += BATCH_SIZE) {
      const batch = masterSwitches.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (masterSwitch) => {
        try {
          const extension = getFileExtension(masterSwitch.imageUrl);
          const filename = `master_${generateFilename(masterSwitch.id, Date.now(), extension)}`;
          const filepath = path.join(DOWNLOAD_DIR, filename);
          
          console.log(`⬇️  Downloading image for master switch "${masterSwitch.name}"`);
          
          await downloadFile(masterSwitch.imageUrl, filepath);
          
          const newImageUrl = `/uploads/${filename}`;
          await prisma.masterSwitch.update({
            where: { id: masterSwitch.id },
            data: { imageUrl: newImageUrl }
          });
          
          console.log(`✅ Migrated image for master switch "${masterSwitch.name}"`);
        } catch (error) {
          console.error(`❌ Failed to migrate image for master switch "${masterSwitch.name}": ${error.message}`);
        }
      }));
    }
    
    console.log('\n✨ Migration completed!');
    
    // Summary
    const totalImages = switches.length + switchImages.length + masterSwitches.length;
    console.log(`\n📊 Migration Summary:`);
    console.log(`   - Switch images: ${switches.length}`);
    console.log(`   - SwitchImage entries: ${switchImages.length}`);
    console.log(`   - MasterSwitch images: ${masterSwitches.length}`);
    console.log(`   - Total images processed: ${totalImages}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateImages().catch(console.error);