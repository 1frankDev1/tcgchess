import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://ehszvqwftqgxjggnbcmt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoc3p2cXdmdHFneGpnZ25iY210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDI5MjAsImV4cCI6MjA4NTMxODkyMH0.wh8_Xy4_w9roFxMgbJ-J9A3r5V7duUjnStl4ZsZ0804';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export function getCurrentUser() {
    const session = localStorage.getItem('tcg_session');
    return session ? JSON.parse(session) : null;
}

export async function customSignIn(username, password) {
    const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error || !data) {
        throw new Error('Usuario o contraseña incorrectos');
    }

    localStorage.setItem('tcg_session', JSON.stringify(data));
    return data;
}

export function customSignOut() {
    localStorage.removeItem('tcg_session');
}

export async function getCharacters() {
    const { data, error } = await supabase
        .from('chess_characters')
        .select('*')
        .order('name', { ascending: true });

    if (error) throw error;
    return data;
}

export async function getUserSelections(userId) {
    const { data, error } = await supabase
        .from('chess_selections')
        .select(`
            *,
            chess_characters (*)
        `)
        .eq('user_id', userId);

    if (error) throw error;
    return data;
}

export async function saveUserSelection(userId, pieceType, characterId, isOpponent = false) {
    // Primero eliminamos la selección anterior para ese tipo de pieza
    await supabase
        .from('chess_selections')
        .delete()
        .eq('user_id', userId)
        .eq('piece_type', pieceType)
        .eq('is_opponent', isOpponent);

    // Insertamos la nueva selección
    const { data, error } = await supabase
        .from('chess_selections')
        .insert([{
            user_id: userId,
            piece_type: pieceType,
            character_id: characterId,
            is_opponent: isOpponent
        }]);

    if (error) throw error;
    return data;
}

export async function getModelUrl(path) {
    if (path.startsWith('http')) return path;
    const { data } = supabase.storage
        .from('spirit')
        .getPublicUrl(path);
    return data.publicUrl;
}

export async function getGltfFiles() {
    const { data, error } = await supabase.storage
        .from('spirit')
        .list('models', { limit: 100 });

    if (error) throw error;

    // We also need to check subfolders or just return what we found
    // The user mentioned "todos mis gltfs".
    // Admin.js suggests they are in models/{folderId}/{filename}

    return data;
}

export { supabase };
