export interface UserAccount {
  username: string;
  passwordHash: string;
  role: "admin" | "editor" | "viewer";
  displayName?: string;
}

export const users: UserAccount[] = [
  { 
    username: "zola",
    passwordHash: "67a20ef9ca16dac572541eaa76e742683bf3785db5e52c5ae9a11d29e794e088", 
    role: "admin",
    displayName: "Zelalem Belay" 
  },
  {
    username: "bule",
    passwordHash: "d88385afb362d3b8d4fc3783190fe3fe34c32e73516731e428e91b6966c9808c",
    role: "editor",
    displayName: "zola"
  }
];

// Alias export to satisfy files importing USERS in uppercase
export const USERS = users;
