// Supabase configuration
const SUPABASE_URL = 'https://dfexbuntvjtdtngnzrqv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmZXhidW50dmp0ZHRuZ256cnF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NDk1ODMsImV4cCI6MjA4NTEyNTU4M30.d8Cu62ibbzR7QArVFaCC2Tp_7fRRcR-RhLOqEoutjhE';

// Initialize Supabase client with a different variable name
let supabaseClient;
if (typeof window.supabase !== 'undefined') {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client initialized');
} else {
  console.error('Supabase library not loaded!');
}

// Database operations
const db = {
  // Get all menu items
  async getMenuItems() {
    try {
      console.log('Fetching menu items from Supabase...');
      const { data, error } = await supabaseClient
        .from('menu_items')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      console.log('Fetched items:', data);
      return data || [];
    } catch (error) {
      console.error('Error fetching menu items:', error);
      throw error;
    }
  },

  // Add new menu item
  async addMenuItem(item) {
    try {
      const { data, error } = await supabaseClient
        .from('menu_items')
        .insert([{
          name: item.name,
          description: item.description,
          tag: item.tag
        }])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error adding menu item:', error);
      throw error;
    }
  },

  // Update menu item
  async updateMenuItem(id, item) {
    try {
      const { data, error } = await supabaseClient
        .from('menu_items')
        .update({
          name: item.name,
          description: item.description,
          tag: item.tag
        })
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error updating menu item:', error);
      throw error;
    }
  },

  // Delete menu item
  async deleteMenuItem(id) {
    try {
      const { error } = await supabaseClient
        .from('menu_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting menu item:', error);
      throw error;
    }
  },

  // Subscribe to real-time changes
  subscribeToChanges(callback) {
    const channel = supabaseClient
      .channel('menu_items_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'menu_items' 
        }, 
        (payload) => {
          console.log('Change received!', payload);
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  }
};

// Make db available globally
window.db = db;
console.log('DB object initialized and attached to window');
