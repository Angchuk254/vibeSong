import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';

// --- CONFIGURATION ---
// Directory where you drop your .mp3 files
const MUSIC_FOLDER = './bulk-music'; 

// 1. Read Supabase credentials from environment.ts
const envFile = fs.readFileSync('./src/app/core/environment.ts', 'utf-8');
const urlMatch = envFile.match(/url:\s*['"]([^'"]+)['"]/);
const keyMatch = envFile.match(/key:\s*['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
  console.error('❌ Could not find Supabase credentials in environment.ts');
  process.exit(1);
}

const supabase = createClient(
  urlMatch[1], 
  keyMatch[2] ? keyMatch[2] : keyMatch[1], 
  { auth: { persistSession: false } }
);

async function runBulkUpload() {
  console.log(`\n🎵 Starting Bulk Upload from folder: ${MUSIC_FOLDER}\n`);

  // Create folder if it doesn't exist
  if (!fs.existsSync(MUSIC_FOLDER)) {
    fs.mkdirSync(MUSIC_FOLDER);
    console.log(`📁 Created folder '${MUSIC_FOLDER}'. Please put your .mp3 files in here and run the script again!`);
    return;
  }

  // Authenticate as Admin to pass Row Level Security (RLS)
  console.log(`🔒 Authenticating with Supabase...`);
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@vibeonly.com',
    password: 'adminPassword123!'
  });

  if (authError) {
    console.error(`❌ Authentication failed: ${authError.message}`);
    return;
  }
  console.log(`✅ Authenticated successfully!`);

  const files = fs.readdirSync(MUSIC_FOLDER).filter(f => f.endsWith('.mp3') || f.endsWith('.wav'));
  
  if (files.length === 0) {
    console.log(`⚠️ No audio files found in ${MUSIC_FOLDER}.`);
    return;
  }

  for (const filename of files) {
    const filePath = path.join(MUSIC_FOLDER, filename);
    const baseName = filename.replace(/\.(mp3|wav)$/, '');
    console.log(`\n⏳ Processing: ${filename}...`);

    try {
      // 1. Extract Metadata and Cover Art directly from the MP3 file!
      const metadata = await parseFile(filePath);
      const title = metadata.common.title || baseName;
      const artist = metadata.common.artist || 'Unknown Artist';
      const album = metadata.common.album || 'Unknown Album';
      const duration = Math.round(metadata.format.duration || 0);
      
      let coverUrl = 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=400&q=80'; // fallback
      
      // 2. Check for Cover Art
      const jpgPath = path.join(MUSIC_FOLDER, `${baseName}.jpg`);
      const pngPath = path.join(MUSIC_FOLDER, `${baseName}.png`);
      
      let coverData = null;
      let coverFormat = 'jpg';
      let mimeType = 'image/jpeg';
      
      if (fs.existsSync(jpgPath)) {
        coverData = fs.readFileSync(jpgPath);
        mimeType = 'image/jpeg';
        console.log(`   🎨 Found matching external cover art (${baseName}.jpg)...`);
      } else if (fs.existsSync(pngPath)) {
        coverData = fs.readFileSync(pngPath);
        coverFormat = 'png';
        mimeType = 'image/png';
        console.log(`   🎨 Found matching external cover art (${baseName}.png)...`);
      } else if (metadata.common.picture && metadata.common.picture.length > 0) {
        coverData = metadata.common.picture[0].data;
        coverFormat = metadata.common.picture[0].format.split('/')[1] || 'jpg';
        mimeType = metadata.common.picture[0].format;
        console.log(`   🎨 Found embedded cover art...`);
      }

      if (coverData) {
        const coverName = `artwork/${Date.now()}_${title.replace(/[^a-zA-Z0-9]/g, '')}.${coverFormat}`;
        console.log(`   ⬆️ Uploading cover art...`);
        const { data: uploadData, error: coverError } = await supabase.storage
          .from('covers')
          .upload(coverName, coverData, { contentType: mimeType });

        if (coverError) throw new Error(`Cover upload failed: ${coverError.message}`);
        coverUrl = supabase.storage.from('covers').getPublicUrl(coverName).data.publicUrl;
      } else {
        console.log(`   🎨 No cover found, using default sleek fallback...`);
      }

      // 3. Upload the Audio file itself to the 'songs' bucket
      console.log(`   🎵 Uploading audio file...`);
      const fileBuffer = fs.readFileSync(filePath);
      const audioName = `audio/${Date.now()}_${filename.replace(/[^a-zA-Z0-9.]/g, '')}`;
      
      const { error: audioError } = await supabase.storage
        .from('songs')
        .upload(audioName, fileBuffer, { contentType: 'audio/mpeg' });

      if (audioError) throw new Error(`Audio upload failed: ${audioError.message}`);
      const audioUrl = supabase.storage.from('songs').getPublicUrl(audioName).data.publicUrl;

      // 4. Insert into the Database
      console.log(`   💾 Saving metadata to database...`);
      const { error: dbError } = await supabase.from('tracks').insert({
        title,
        artist,
        album,
        duration,
        audio_url: audioUrl,
        image_url: coverUrl
      });

      if (dbError) throw new Error(`Database insert failed: ${dbError.message}`);

      console.log(`✅ Success: ${title} by ${artist} uploaded!`);

    } catch (err) {
      console.error(`❌ Error processing ${filename}:`, err.message);
    }
  }

  console.log(`\n🎉 Bulk upload finished!`);
}

runBulkUpload();
