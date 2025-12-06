// Simple test to verify Gemini API is working
// Run with: node test-api.js

import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const API_KEY = process.env.VITE_GEMINI_API_KEY;

console.log('🔍 Testing Gemini API...\n');

// Check if API key exists
if (!API_KEY) {
    console.error('❌ ERROR: VITE_GEMINI_API_KEY not found in .env.local');
    console.log('\nPlease add your API key to .env.local:');
    console.log('VITE_GEMINI_API_KEY=your-key-here\n');
    process.exit(1);
}

console.log(`✓ API Key found: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);

// Test the API
const ai = new GoogleGenAI({ apiKey: API_KEY });

async function testAPI() {
    try {
        console.log('\n📡 Sending test request to Gemini...');

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: 'Say "API is working!" if you can read this.' }] }
        });

        if (response.text) {
            console.log('\n✅ SUCCESS! Gemini API is working!\n');
            console.log('Response:', response.text);
            console.log('\n🎉 You can now use all online features!\n');
        } else {
            console.log('\n⚠️  WARNING: Got response but no text');
            console.log('Response:', response);
        }
    } catch (error) {
        console.error('\n❌ ERROR: Failed to connect to Gemini API\n');
        console.error('Error:', error.message);

        if (error.message.includes('API key')) {
            console.log('\n💡 Possible issues:');
            console.log('   - API key is invalid');
            console.log('   - API key doesn\'t have Gemini API enabled');
            console.log('   - Check: https://aistudio.google.com/app/apikey\n');
        } else if (error.message.includes('quota')) {
            console.log('\n💡 You may have exceeded your API quota');
            console.log('   Free tier: 15 requests/minute, 1500/day\n');
        } else {
            console.log('\n💡 Check your internet connection\n');
        }

        process.exit(1);
    }
}

testAPI();
