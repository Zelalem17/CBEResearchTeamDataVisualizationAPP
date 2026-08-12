export interface UserAccount {
  username: string;
  passwordHash: string;
  role: "admin" | "editor" | "viewer";
  displayName?: string;
}
 export const users: UserAccount[] = [
  { 
    username: "admin",
    passwordHash: "67a20ef9ca16dac572541eaa76e742683bf3785db5e52c5ae9a11d29e794e088", 
    role: "admin",
    displayName: "Zelalem Belay" 
  },
  { username: "bule",
    passwordHash: "d88385afb362d3b8d4fc3783190fe3fe34c32e73516731e428e91b6966c9808c",
    role: "editor",
    displayName: "zola"
  },
     { username: "070695",
   passwordHash: "887315f08fe20c8dd988313aaae4ff87d94d18ea7488d3c4f827b617c48684ad", 
   role: "editor", 
   displayName: "Zelalem Belay" },
]; 

// Alias export to satisfy files importing USERS in uppercase
export const USERS = users;
