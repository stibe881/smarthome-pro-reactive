import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase configuration
// Note: We need service role key or appropriate RLS to insert data
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''; // Preferably Service Role Key

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or KEY in environment relative to where this runs.");
  console.log("Please export EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Household ID to assign imported recipes to
// The user asked to import to "ihrem tenant". We need to find the household_id.
// Usually in these systems one admin user has one household. We'll query it or prompt it.
const HOUSEHOLD_ID = process.argv[2];

if (!HOUSEHOLD_ID) {
  console.error("Please provide household_id as the first argument.");
  process.exit(1);
}

const FILE_PATH = path.join(__dirname, 'mmmh_rezepte_export_2026-02-27.json');

async function importRecipes() {
  try {
    const fileContent = fs.readFileSync(FILE_PATH, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!data.recipes || !Array.isArray(data.recipes)) {
      throw new Error("Invalid JSON structure: missing 'recipes' array");
    }

    console.log(`Found ${data.recipes.length} recipes to import.`);
    
    let importedCount = 0;
    let errorCount = 0;

    for (const recipe of data.recipes) {
      // 1. Convert Base64 image to Blob/URL (mocked here, we'll probably skip image upload as it's base64 or upload it via UI if it's too large, but wait, the project 'recipe_app' KI mentions 'file-to-blob conversion pattern for Supabase Storage uploads'. Let's see if we can do it via the app, or skip the image for now or upload it to Supabase Storage).
      // Given the complexity of base64 in a server script uploading to supabase storage, we'll try to just import the structured data first to avoid bloat, or we do it properly. Let's look at the database schema first.
      
      // Map ingredients from JSON
      const igString = recipe.ingredients.map((i: any) => `${i.amount ? i.amount + ' ' : ''}${i.unit ? i.unit + ' ' : ''}${i.name}`).join('\n');
      const inString = recipe.steps.map((s: any, idx: number) => `${idx + 1}. ${s.instruction}`).join('\n');

      const payload = {
         household_id: HOUSEHOLD_ID,
         title: recipe.title,
         description: recipe.description,
         servings: recipe.servings,
         prep_time: recipe.prepTime,
         cook_time: recipe.cookTime,
         difficulty: recipe.difficulty,
         category: recipe.category || 'other', 
         is_favorite: false,
         ingredients: igString, 
         instructions: inString,
         tags: recipe.tags || [],
         image_url: recipe.images?.length > 0 ? recipe.images[0] : null
      };

      const { data: insertedData, error } = await supabase
        .from('family_recipes')
        .insert(payload);

      if (error) {
        console.error(`Error importing recipe "${recipe.title}":`, error.message);
        errorCount++;
      } else {
        console.log(`Successfully imported: ${recipe.title}`);
        importedCount++;
      }
    }

    console.log(`Import complete. Success: ${importedCount}, Errors: ${errorCount}`);
  } catch (err: any) {
    console.error("Import failed:", err.message);
  }
}

importRecipes();
