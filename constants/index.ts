export const COLLECTIONS = {
  USERS: 'users',
  GROUPS: 'groups',
  SHOPPING_LISTS: 'shoppingLists',
  ITEMS: 'items',
  CHATS: 'chats',
  MESSAGES: 'messages',
} as const;

export const COLORS = {
  PRIMARY: '#4CAF50',          
  PRIMARY_DARK: '#388E3C',      
  SECONDARY: '#FFC107',         
  SUCCESS: '#4CAF50',           
  ERROR: '#F44336',             
  WARNING: '#FF9800',           
  INFO: '#2196F3',              

  WHITE: '#FFFFFF',             
  BLACK: '#333333',             
  BACKGROUND: '#F7FBF6',        
  BACKGROUND_SECONDARY: '#FFFFFF', 

  TEXT_PRIMARY: '#333333',      
  TEXT_SECONDARY: '#666666',   
  TEXT_TERTIARY: '#999999',     

  BORDER_LIGHT: '#E8F5E9',     
  BORDER_DEFAULT: '#C8E6C9',    
  BORDER_DARK: '#A5D6A7',       

  LINK: '#4CAF50',             
  DISABLED: '#BDBDBD',         
  COMPLETED: '#9E9E9E',         
} as const;

export const VALIDATION = {
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  MAX_MESSAGE_LENGTH: 1000,
  MAX_ITEM_NAME_LENGTH: 200,
  MIN_PASSWORD_LENGTH: 6,
} as const;

export const TIMEOUTS = {
  DEFAULT_OPERATION: 10000,
  IMAGE_UPLOAD: 30000,
} as const;

export const IMAGE = {
  MAX_SIZE: 5 * 1024 * 1024,
  MAX_WIDTH: 1024,
  MAX_HEIGHT: 1024,
  COMPRESSION_QUALITY: 0.8,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;
