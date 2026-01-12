import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ==================== SAFARIGAM.COM ====================
// 1000 African Species Educational Wildlife Adventure
// Version 2.0 - Guest Mode, Auth, Persistence, Achievements
// ========================================================

// ==================== CONSTANTS ====================
const STATE_VERSION = 'v2';
const STATE_KEY = `safarigam_${STATE_VERSION}_state`;
const USER_KEY = `safarigam_${STATE_VERSION}_user`;
const GUEST_TIME_LIMIT_MS = 10 * 60 * 60 * 1000; // 10 hours in milliseconds
const SAVE_DEBOUNCE_MS = 1000;
const PLAYTIME_UPDATE_INTERVAL_MS = 60000; // Update playtime every minute

// ==================== ACHIEVEMENTS DEFINITIONS ====================
const ACHIEVEMENTS = [
  { id: 'FIRST_SAFARI', name: 'First Steps', description: 'Complete your first safari', icon: '🐾', check: (s) => s.visited.length >= 1 },
  { id: 'VISIT_3_DESTINATIONS', name: 'World Traveler', description: 'Visit 3 destinations', icon: '🌍', check: (s) => s.visited.length >= 3 },
  { id: 'VISIT_ALL_DESTINATIONS', name: 'Globe Trotter', description: 'Visit all 6 destinations', icon: '✈️', check: (s) => s.visited.length >= 6 },
  { id: 'UNLOCK_50_SPECIES', name: 'Species Collector', description: 'Unlock 50 species', icon: '🔓', check: (s) => s.unlocked.length >= 50 },
  { id: 'UNLOCK_100_SPECIES', name: 'Wildlife Expert', description: 'Unlock 100 species', icon: '🏆', check: (s) => s.unlocked.length >= 100 },
  { id: 'UNLOCK_500_SPECIES', name: 'Master Naturalist', description: 'Unlock 500 species', icon: '👑', check: (s) => s.unlocked.length >= 500 },
  { id: 'EARN_500_POINTS', name: 'Point Collector', description: 'Earn 500 Ulimanta Points', icon: '✨', check: (s) => s.points >= 500 },
  { id: 'EARN_1000_POINTS', name: 'Safari Champion', description: 'Earn 1000 Ulimanta Points', icon: '🌟', check: (s) => s.points >= 1000 },
  { id: 'QUIZ_MASTER', name: 'Quiz Master', description: 'Answer 10 quizzes correctly', icon: '🧠', check: (s) => s.quizzesCorrect >= 10 },
  { id: 'EXPLORER_MODE', name: 'True Explorer', description: 'Play in Explorer mode', icon: '🔭', check: (s) => !s.kidMode },
];

// ==================== STORAGE MODULE ====================
const storage = {
  isAvailable: () => {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  },

  getState: () => {
    try {
      const data = localStorage.getItem(STATE_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return parsed;
    } catch (e) {
      console.warn('Failed to load state:', e);
      return null;
    }
  },

  setState: (state) => {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Failed to save state:', e);
      return false;
    }
  },

  clearState: () => {
    try {
      localStorage.removeItem(STATE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }
};

// ==================== AUTH MODULE ====================
const auth = {
  getUser: () => {
    try {
      const data = localStorage.getItem(USER_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  setUser: (user) => {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return true;
    } catch (e) {
      return false;
    }
  },

  signUp: (provider, data = {}) => {
    const user = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nickname: data.nickname || `Explorer${Math.floor(Math.random() * 9999)}`,
      email: data.email || null,
      provider: provider,
      createdAt: new Date().toISOString(),
      isGuest: false
    };
    auth.setUser(user);
    return user;
  },

  signIn: (provider, data = {}) => {
    return auth.signUp(provider, data);
  },

  signOut: () => {
    try {
      localStorage.removeItem(USER_KEY);
      return true;
    } catch (e) {
      return false;
    }
  },

  isAuthenticated: () => {
    const user = auth.getUser();
    return user && !user.isGuest;
  }
};

// ==================== DEFAULT STATE ====================
const getDefaultState = () => ({
  points: 0,
  visited: [],
  unlocked: Array.from({ length: 32 }, (_, i) => i + 1),
  kidMode: false,
  animal: null,
  park: null,
  screen: 'welcome',
  guestPlaytimeMs: 0,
  quizzesCorrect: 0,
  earnedAchievements: [],
  lastSaved: null
});

// ==================== SPECIES DATA ====================
const AFRICAN_ANIMALS = (() => {
  const species = [];
  let id = 1;
  
  const coreSpecies = [
    { name: "African Lion", category: "Mammal", habitat: "Savanna", status: "Vulnerable", parks: ["Serengeti", "Maasai Mara", "Kruger"], fact: "Lions are the only cats that live in groups called prides.", swahili: "Simba", emoji: "🦁" },
    { name: "Leopard", category: "Mammal", habitat: "Various", status: "Vulnerable", parks: ["Kruger", "Serengeti"], fact: "Can carry prey twice their weight up trees.", swahili: "Chui", emoji: "🐆" },
    { name: "Cheetah", category: "Mammal", habitat: "Savanna", status: "Vulnerable", parks: ["Serengeti", "Maasai Mara"], fact: "Fastest land animal - 70 mph in 3 seconds!", swahili: "Duma", emoji: "🐆" },
    { name: "Mountain Gorilla", category: "Mammal", habitat: "Montane forest", status: "Endangered", parks: ["Bwindi", "Virunga"], fact: "Shares 98% of DNA with humans.", swahili: "Sokwe Mtu", emoji: "🦍" },
    { name: "African Elephant", category: "Mammal", habitat: "Savanna", status: "Endangered", parks: ["Amboseli", "Chobe", "Kruger"], fact: "Largest land animal - ears shaped like Africa!", swahili: "Tembo", emoji: "🐘" },
    { name: "Black Rhinoceros", category: "Mammal", habitat: "Scrubland", status: "Critically Endangered", parks: ["Etosha", "Ngorongoro"], fact: "Has hooked lip for browsing leaves.", swahili: "Faru", emoji: "🦏" },
    { name: "Giraffe", category: "Mammal", habitat: "Savanna", status: "Vulnerable", parks: ["Serengeti", "Maasai Mara"], fact: "Each pattern is unique like a fingerprint!", swahili: "Twiga", emoji: "🦒" },
    { name: "Hippopotamus", category: "Mammal", habitat: "Rivers", status: "Vulnerable", parks: ["Okavango", "Queen Elizabeth"], fact: "Sweats a red substance that acts as sunscreen!", swahili: "Kiboko", emoji: "🦛" },
    { name: "African Buffalo", category: "Mammal", habitat: "Savanna", status: "Near Threatened", parks: ["Kruger", "Serengeti"], fact: "Has incredible memory - will seek revenge.", swahili: "Nyati", emoji: "🐃" },
    { name: "Common Zebra", category: "Mammal", habitat: "Savanna", status: "Near Threatened", parks: ["Serengeti", "Kruger"], fact: "No two have the same stripe pattern!", swahili: "Punda Milia", emoji: "🦓" },
    { name: "African Wild Dog", category: "Mammal", habitat: "Savanna", status: "Endangered", parks: ["Okavango", "Kruger"], fact: "80% hunt success - most effective predator!", swahili: "Mbwa Mwitu", emoji: "🐕" },
    { name: "Spotted Hyena", category: "Mammal", habitat: "Savanna", status: "Least Concern", parks: ["Serengeti"], fact: "Strongest bite force - females lead!", swahili: "Fisi", emoji: "🐺" },
    { name: "Chimpanzee", category: "Mammal", habitat: "Rainforest", status: "Endangered", parks: ["Kibale", "Gombe"], fact: "Uses tools and can learn sign language.", swahili: "Sokwe", emoji: "🐵" },
    { name: "Pangolin", category: "Mammal", habitat: "Various", status: "Critically Endangered", parks: ["Kruger", "Congo"], fact: "World's most trafficked mammal.", swahili: "Kakakuona", emoji: "🦔" },
    { name: "Secretary Bird", category: "Bird", habitat: "Grassland", status: "Endangered", parks: ["Serengeti"], fact: "Stomps snakes with 5x body weight!", swahili: "Nderi", emoji: "🦅" },
    { name: "African Fish Eagle", category: "Bird", habitat: "Near water", status: "Least Concern", parks: ["Lake Naivasha"], fact: "Its call is the 'voice of Africa'.", swahili: "Furukombe", emoji: "🦅" },
    { name: "Shoebill Stork", category: "Bird", habitat: "Papyrus swamps", status: "Vulnerable", parks: ["Murchison"], fact: "Prehistoric - stands motionless for hours!", emoji: "🦅" },
    { name: "Lilac-breasted Roller", category: "Bird", habitat: "Savanna", status: "Least Concern", parks: ["Kruger", "Serengeti"], fact: "Kenya's national bird - 8 colors!", swahili: "Kambu", emoji: "🐦" },
    { name: "African Grey Parrot", category: "Bird", habitat: "Rainforest", status: "Endangered", parks: ["Congo"], fact: "Can learn 1,000+ words!", swahili: "Kasuku", emoji: "🦜" },
    { name: "Ostrich", category: "Bird", habitat: "Savanna", status: "Least Concern", parks: ["Serengeti"], fact: "Largest bird - runs 70 km/h!", swahili: "Mbuni", emoji: "🐦" },
    { name: "Greater Flamingo", category: "Bird", habitat: "Alkaline lakes", status: "Least Concern", parks: ["Lake Nakuru"], fact: "Gets pink color from algae!", swahili: "Heroe", emoji: "🦩" },
    { name: "African Penguin", category: "Bird", habitat: "Coast", status: "Endangered", parks: ["Boulders Beach"], fact: "Only penguin in Africa!", emoji: "🐧" },
    { name: "Nile Crocodile", category: "Reptile", habitat: "Rivers", status: "Least Concern", parks: ["Murchison", "Kruger"], fact: "Grows to 6 meters, lives 100 years!", swahili: "Mamba", emoji: "🐊" },
    { name: "Black Mamba", category: "Reptile", habitat: "Savanna", status: "Least Concern", parks: ["Kruger"], fact: "Fastest snake - named for black mouth!", swahili: "Mamba Mweusi", emoji: "🐍" },
    { name: "Nile Monitor", category: "Reptile", habitat: "Near water", status: "Least Concern", parks: ["Throughout Africa"], fact: "Africa's largest lizard - 2 meters!", swahili: "Kenge", emoji: "🦎" },
    { name: "Leopard Tortoise", category: "Reptile", habitat: "Savanna", status: "Least Concern", parks: ["Kruger", "Serengeti"], fact: "Lives over 100 years!", swahili: "Kobe", emoji: "🐢" },
    { name: "African Bullfrog", category: "Amphibian", habitat: "Wetlands", status: "Least Concern", parks: ["Southern Africa"], fact: "Males guard tadpoles - attack lions!", swahili: "Chura Dume", emoji: "🐸" },
    { name: "Goliath Frog", category: "Amphibian", habitat: "Fast rivers", status: "Endangered", parks: ["Cameroon"], fact: "World's largest frog - 3kg!", emoji: "🐸" },
    { name: "Coelacanth", category: "Fish", habitat: "Deep ocean", status: "Critically Endangered", parks: ["Comoros"], fact: "Living fossil - 65 million years old!", emoji: "🐟" },
    { name: "Whale Shark", category: "Fish", habitat: "Coast", status: "Endangered", parks: ["Mafia Island"], fact: "Largest fish - eats only plankton!", emoji: "🦈" },
    { name: "African Dung Beetle", category: "Invertebrate", habitat: "Savanna", status: "Least Concern", parks: ["Throughout Africa"], fact: "Navigates by the Milky Way!", swahili: "Mdudu wa Mavi", emoji: "🪲" },
    { name: "Goliath Beetle", category: "Invertebrate", habitat: "Forest", status: "Least Concern", parks: ["Congo"], fact: "One of heaviest insects!", emoji: "🪲" },
  ];
  
  coreSpecies.forEach(s => species.push({ id: id++, ...s }));
  
  const mammals = ["Caracal", "Serval", "African Wildcat", "Black-footed Cat", "African Golden Cat", "Sand Cat", "Bonobo", "Mandrill", "Drill", "Olive Baboon", "Yellow Baboon", "Chacma Baboon", "Gelada", "Black-and-white Colobus", "Vervet Monkey", "Blue Monkey", "Golden Monkey", "De Brazza's Monkey", "Patas Monkey", "Northern Galago", "Potto", "Eastern Lowland Gorilla", "Western Lowland Gorilla", "Cross River Gorilla", "White Rhinoceros", "Forest Elephant", "Okapi", "Pygmy Hippopotamus", "Masai Giraffe", "Reticulated Giraffe", "Rothschild's Giraffe", "Blue Wildebeest", "Black Wildebeest", "Grevy's Zebra", "Mountain Zebra", "African Wild Ass", "Impala", "Greater Kudu", "Lesser Kudu", "Common Eland", "Giant Eland", "Bongo", "Sitatunga", "Bushbuck", "Nyala", "Mountain Nyala", "Gerenuk", "Kirk's Dik-dik", "Topi", "Hartebeest", "Hirola", "Waterbuck", "Kob", "Lechwe", "Puku", "Reedbuck", "Oryx", "Beisa Oryx", "Addax", "Roan Antelope", "Sable Antelope", "Thomson's Gazelle", "Grant's Gazelle", "Dorcas Gazelle", "Springbok", "Klipspringer", "Oribi", "Steenbok", "Suni", "Blue Duiker", "Common Duiker", "Red Duiker", "Yellow-backed Duiker", "Striped Hyena", "Brown Hyena", "Aardwolf", "Black-backed Jackal", "Side-striped Jackal", "Bat-eared Fox", "Cape Fox", "Fennec Fox", "Honey Badger", "African Civet", "Common Genet", "Large-spotted Genet", "Banded Mongoose", "Dwarf Mongoose", "Slender Mongoose", "Egyptian Mongoose", "White-tailed Mongoose", "Marsh Mongoose", "Meerkat", "Yellow Mongoose", "Cape Clawless Otter", "Spotted-necked Otter", "Zorilla", "Aardvark", "Rock Hyrax", "Tree Hyrax", "Spring Hare", "Cape Porcupine", "Crested Porcupine", "African Giant Pouched Rat", "Naked Mole Rat", "Straw-coloured Fruit Bat", "Hammer-headed Bat", "Egyptian Fruit Bat", "African Manatee", "Cape Fur Seal", "Giant Forest Hog", "Warthog", "Bush Pig", "Red River Hog", "Golden-rumped Elephant Shrew", "Four-toed Elephant Shrew", "Giant Ground Pangolin", "Tree Pangolin"];
  
  const birds = ["Martial Eagle", "Crowned Eagle", "Bateleur", "Verreaux's Eagle", "Tawny Eagle", "Goliath Heron", "Saddle-billed Stork", "Marabou Stork", "Hamerkop", "African Sacred Ibis", "Great Blue Turaco", "Superb Starling", "Grey Crowned Crane", "Blue Crane", "Wattled Crane", "Lesser Flamingo", "Southern Ground Hornbill", "Yellow-billed Hornbill", "Red-billed Hornbill", "Silvery-cheeked Hornbill", "Kori Bustard", "Pel's Fishing Owl", "Verreaux's Eagle-Owl", "Malachite Kingfisher", "Pied Kingfisher", "Giant Kingfisher", "Lappet-faced Vulture", "Rüppell's Vulture", "White-backed Vulture", "Hooded Vulture", "Cape Vulture", "Bearded Vulture", "African Paradise Flycatcher", "Fork-tailed Drongo", "Village Weaver", "Red-billed Quelea", "Pin-tailed Whydah", "African Hoopoe", "Carmine Bee-eater", "Malachite Sunbird", "African Jacana", "Black Crake", "African Pygmy Goose", "White-faced Whistling Duck", "Spur-winged Goose", "Egyptian Goose", "Knob-billed Duck", "African Darter", "Reed Cormorant", "African Spoonbill", "Hadada Ibis", "Glossy Ibis", "Black-headed Heron", "Grey Heron", "Purple Heron", "Great Egret", "Cattle Egret", "Cape Gannet", "Great White Pelican", "Pink-backed Pelican", "African Goshawk", "Gabar Goshawk", "Dark Chanting Goshawk", "Pale Chanting Goshawk", "Lizard Buzzard", "Augur Buzzard", "Bat Hawk", "African Pygmy Falcon", "Lanner Falcon", "Peregrine Falcon", "Grey Kestrel", "Common Kestrel", "European Bee-eater", "Blue-cheeked Bee-eater", "White-fronted Bee-eater", "Little Bee-eater", "Swallow-tailed Bee-eater", "African Pygmy Kingfisher", "Woodland Kingfisher", "Ross's Turaco", "Hartlaub's Turaco", "Grey Go-away-bird", "Green Wood Hoopoe", "Scimitarbill", "Von der Decken's Hornbill", "Black-and-white-casqued Hornbill", "Trumpeter Hornbill", "Abyssinian Ground Hornbill", "African Scops Owl", "White-faced Scops Owl", "Pearl-spotted Owlet", "African Wood Owl", "Spotted Eagle-Owl", "Fiery-necked Nightjar", "Pennant-winged Nightjar", "Common Swift", "African Swift", "Palm Swift", "Alpine Swift", "African Cuckoo", "Levaillant's Cuckoo", "Jacobin Cuckoo", "Klaas's Cuckoo", "Diederik Cuckoo", "White-browed Coucal", "African Emerald Cuckoo", "Violet-backed Starling", "Greater Blue-eared Starling", "African Pitta", "White-crested Helmetshrike", "Brubru", "Black-backed Puffback", "Grey-headed Bush-shrike", "Crimson-breasted Shrike", "Magpie Shrike", "Fiscal Shrike", "Red-backed Shrike", "Square-tailed Drongo", "African Black-headed Oriole", "Pied Crow", "White-necked Raven", "Cape Crow", "Thick-billed Raven", "Scarlet-chested Sunbird", "Beautiful Sunbird", "Variable Sunbird", "Collared Sunbird", "Golden-winged Sunbird", "Tacazze Sunbird", "Spectacled Weaver", "Southern Masked Weaver", "Red-headed Weaver", "Golden Weaver", "Red Bishop", "Yellow Bishop", "Long-tailed Widowbird", "Red-billed Firefinch", "Blue Waxbill", "Common Waxbill", "Cut-throat Finch", "Bronze Mannikin"];
  
  const reptiles = ["Dwarf Crocodile", "Slender-snouted Crocodile", "African Rock Python", "Green Mamba", "Egyptian Cobra", "Puff Adder", "Gaboon Viper", "Rhinoceros Viper", "Boomslang", "Savanna Monitor", "Jackson's Chameleon", "Panther Chameleon", "Agama Lizard", "African Spurred Tortoise", "Pancake Tortoise", "Green Sea Turtle", "Leatherback Sea Turtle", "Spitting Cobra", "Cape Cobra", "Forest Cobra", "Vine Snake", "Twig Snake", "Egg-eating Snake", "Mole Snake", "House Snake", "Flap-necked Chameleon", "Graceful Chameleon", "Common Chameleon", "Pygmy Chameleon", "African House Gecko", "Tropical House Gecko", "Giant Day Gecko", "Rainbow Skink", "Plated Lizard", "Girdled Lizard", "Armadillo Lizard", "Rock Monitor", "White-throated Monitor"];
  
  const amphibians = ["African Clawed Frog", "Painted Reed Frog", "Hairy Frog", "Common Rain Frog", "Foam-nest Frog", "Ghost Frog", "Shovel-nosed Frog", "Running Frog", "Guttural Toad", "Red Toad", "Pygmy Toad", "African Tree Frog", "Sedge Frog", "Grass Frog", "River Frog", "Leaf-folding Frog", "Puddle Frog", "Squeaker Frog", "Bubbling Kassina", "Red-banded Rubber Frog"];
  
  const fish = ["Lungfish", "Cichlid", "Electric Catfish", "Tiger Fish", "Goliath Tiger Fish", "Nile Perch", "Tilapia", "Great White Shark", "Manta Ray", "Bichir", "Elephantnose Fish", "African Catfish", "Sharptooth Catfish", "Squeaker Catfish", "Upside-down Catfish", "Barb", "Yellowfish", "Labeo", "Killifish", "African Tetra", "Mudfish", "Bull Shark", "Mako Shark", "Hammerhead Shark"];
  
  const invertebrates = ["African Giant Millipede", "Emperor Scorpion", "African Driver Ant", "Matabele Ant", "Tsetse Fly", "African Giant Swallowtail", "Painted Lady", "African Baboon Spider", "Golden Orb Weaver", "African Land Snail", "Praying Mantis", "Desert Locust", "African Honeybee", "Rhinoceros Beetle", "Jewel Beetle", "Longhorn Beetle", "Firefly", "Charaxes Butterfly", "Swallowtail Butterfly", "Emperor Moth", "Moon Moth", "Hawk Moth", "Carpenter Bee", "Stingless Bee", "Paper Wasp", "Potter Wasp", "Spider Wasp", "Velvet Ant", "Bull Ant", "Leafcutter Ant", "African Cicada", "Treehopper", "Leafhopper", "Dragonfly", "Damselfly", "Stick Insect", "Leaf Insect", "Flower Mantis", "Ghost Mantis", "Bush Cricket", "Mole Cricket", "Grasshopper", "Katydid", "Giant Cockroach", "Hissing Cockroach", "Stone Centipede", "Giant Centipede", "Pill Millipede", "Flat Rock Scorpion", "Thick-tailed Scorpion", "Huntsman Spider", "Jumping Spider", "Wolf Spider", "Rain Spider", "Sun Spider", "Whip Spider", "Velvet Worm", "Giant Earthworm"];
  
  [mammals, birds, reptiles, amphibians, fish, invertebrates].forEach((list, catIdx) => {
    const categories = ["Mammal", "Bird", "Reptile", "Amphibian", "Fish", "Invertebrate"];
    const emojis = ["🦁", "🐦", "🦎", "🐸", "🐟", "🪲"];
    list.forEach(name => {
      if (species.length < 1000) {
        species.push({
          id: id++, name, category: categories[catIdx], habitat: "Various African habitats",
          status: "Data Deficient", parks: ["Various parks"],
          fact: `The ${name} is one of Africa's fascinating ${categories[catIdx].toLowerCase()} species.`,
          emoji: emojis[catIdx]
        });
      }
    });
  });
  
  while (species.length < 1000) {
    species.push({
      id: id++, name: `African Species #${species.length + 1}`, category: "Unknown",
      habitat: "Unknown", status: "Data Deficient", parks: ["Unexplored regions"],
      fact: "Many species in Africa are still waiting to be discovered!", emoji: "❓"
    });
  }
  
  return species;
})();

// Parks Data
const AFRICAN_PARKS = [
  { id: 1, name: "Serengeti National Park", country: "Tanzania", ecosystem: "Savanna", description: "Home to the Great Migration - over 2 million wildebeest.", color: "#E8A735" },
  { id: 2, name: "Maasai Mara National Reserve", country: "Kenya", ecosystem: "Savanna", description: "Where the Great Migration ends with spectacular river crossings.", color: "#D4A574" },
  { id: 3, name: "Kruger National Park", country: "South Africa", ecosystem: "Savanna", description: "One of Africa's largest reserves with Big Five.", color: "#8B4513" },
  { id: 4, name: "Okavango Delta", country: "Botswana", ecosystem: "Wetland", description: "World's largest inland delta.", color: "#4A90A4" },
  { id: 5, name: "Virunga National Park", country: "DRC", ecosystem: "Montane", description: "Africa's oldest park - mountain gorillas.", color: "#2D5A27" },
  { id: 6, name: "Bwindi Impenetrable", country: "Uganda", ecosystem: "Rainforest", description: "Half of world's mountain gorillas.", color: "#1B4D3E" },
  { id: 7, name: "Ngorongoro Crater", country: "Tanzania", ecosystem: "Volcanic", description: "World's largest intact volcanic caldera.", color: "#6B8E23" },
  { id: 8, name: "Etosha National Park", country: "Namibia", ecosystem: "Salt Pan", description: "Vast salt pan visible from space.", color: "#F5F5DC" },
  { id: 9, name: "Amboseli National Park", country: "Kenya", ecosystem: "Savanna", description: "Elephants against Mount Kilimanjaro.", color: "#87CEEB" },
  { id: 10, name: "Chobe National Park", country: "Botswana", ecosystem: "Riverine", description: "Largest elephant concentration - 50,000+.", color: "#2E8B57" },
];

// Global Destinations
const GLOBAL_DESTINATIONS = [
  { id: 1, name: "Amazon Rainforest", region: "South America", description: "Earth's largest rainforest.", keySpecies: ["Jaguar", "Giant Otter", "Harpy Eagle"], color: "#228B22", points: 150 },
  { id: 2, name: "Galápagos Islands", region: "South America", description: "Where Darwin's theory evolved.", keySpecies: ["Giant Tortoise", "Marine Iguana"], color: "#4682B4", points: 200 },
  { id: 3, name: "Great Barrier Reef", region: "Oceania", description: "World's largest coral reef.", keySpecies: ["Sea Turtle", "Clownfish", "Manta Ray"], color: "#00CED1", points: 180 },
  { id: 4, name: "Himalayas", region: "Asia", description: "Roof of the world.", keySpecies: ["Snow Leopard", "Red Panda"], color: "#6495ED", points: 220 },
  { id: 5, name: "Arctic Tundra", region: "Arctic", description: "Frozen frontier.", keySpecies: ["Polar Bear", "Arctic Wolf", "Caribou"], color: "#E0FFFF", points: 250 },
  { id: 6, name: "Madagascar", region: "Indian Ocean", description: "Island of lemurs - 90% endemic.", keySpecies: ["Ring-tailed Lemur", "Fossa"], color: "#8B4513", points: 190 },
];

// Proverbs
const PROVERBS = [
  { text: "Haraka haraka haina baraka", translation: "Hurry hurry has no blessing", language: "Swahili" },
  { text: "Umuntu ngumuntu ngabantu", translation: "I am because we are", language: "Zulu" },
  { text: "Motho ke motho ka batho", translation: "A person is a person through others", language: "Sotho" },
  { text: "Akili ni mali", translation: "Wisdom is wealth", language: "Swahili" },
  { text: "Boboto boleki makasi", translation: "Kindness surpasses strength", language: "Lingala" },
];

// ==================== MAIN COMPONENT ====================
const Safarigam = () => {
  const [storageAvailable] = useState(() => storage.isAvailable());
  
  const [gameState, setGameState] = useState(() => {
    if (storageAvailable) {
      const saved = storage.getState();
      if (saved) return { ...getDefaultState(), ...saved };
    }
    return getDefaultState();
  });
  
  const [user, setUser] = useState(() => auth.getUser());
  
  const [safari, setSafari] = useState(null);
  const [progress, setProgress] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [proverb, setProverb] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signup');
  const [authProvider, setAuthProvider] = useState(null);
  const [authForm, setAuthForm] = useState({ nickname: '', email: '', password: '' });
  const [achievementToast, setAchievementToast] = useState(null);
  
  const saveTimeoutRef = useRef(null);
  const playtimeIntervalRef = useRef(null);
  
  const { points, visited, unlocked, kidMode, animal, park, screen, guestPlaytimeMs, earnedAchievements, quizzesCorrect } = gameState;

  const updateState = useCallback((patch) => {
    setGameState(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      return next;
    });
  }, []);

  const resetState = useCallback(() => {
    setGameState(getDefaultState());
    if (storageAvailable) storage.clearState();
  }, [storageAvailable]);

  useEffect(() => {
    if (!storageAvailable) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      storage.setState({ ...gameState, lastSaved: new Date().toISOString() });
    }, SAVE_DEBOUNCE_MS);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [gameState, storageAvailable]);

  const isAuthenticated = user && !user.isGuest;
  const isTimeLimitReached = !isAuthenticated && guestPlaytimeMs >= GUEST_TIME_LIMIT_MS;
  
  useEffect(() => {
    if (isAuthenticated || isTimeLimitReached) return;
    playtimeIntervalRef.current = setInterval(() => {
      updateState(prev => ({ ...prev, guestPlaytimeMs: prev.guestPlaytimeMs + PLAYTIME_UPDATE_INTERVAL_MS }));
    }, PLAYTIME_UPDATE_INTERVAL_MS);
    return () => { if (playtimeIntervalRef.current) clearInterval(playtimeIntervalRef.current); };
  }, [isAuthenticated, isTimeLimitReached, updateState]);
  
  useEffect(() => {
    if (isTimeLimitReached && !showAuthGate) setShowAuthGate(true);
  }, [isTimeLimitReached, showAuthGate]);

  const checkAchievements = useCallback((state) => {
    const newAchievements = [];
    ACHIEVEMENTS.forEach(achievement => {
      if (!state.earnedAchievements.includes(achievement.id) && achievement.check(state)) {
        newAchievements.push(achievement);
      }
    });
    if (newAchievements.length > 0) {
      setAchievementToast(newAchievements[0]);
      setTimeout(() => setAchievementToast(null), 4000);
      updateState(prev => ({ ...prev, earnedAchievements: [...prev.earnedAchievements, ...newAchievements.map(a => a.id)] }));
    }
  }, [updateState]);
  
  useEffect(() => { checkAchievements(gameState); }, [points, visited.length, unlocked.length, quizzesCorrect, kidMode]);

  const handleSignUp = useCallback((provider) => {
    let userData = {};
    if (provider === 'nickname') {
      if (!authForm.nickname.trim()) return;
      userData = { nickname: authForm.nickname.trim() };
    } else if (provider === 'email') {
      if (!authForm.email.trim() || !authForm.password) return;
      userData = { nickname: authForm.nickname.trim() || undefined, email: authForm.email.trim() };
    } else if (provider === 'google') {
      userData = { nickname: `GoogleUser${Math.floor(Math.random() * 9999)}`, email: `user${Date.now()}@gmail.com` };
    }
    const newUser = auth.signUp(provider, userData);
    setUser(newUser);
    setShowAuthModal(false);
    setShowAuthGate(false);
    setAuthForm({ nickname: '', email: '', password: '' });
  }, [authForm]);
  
  const handleSignIn = useCallback((provider) => { handleSignUp(provider); }, [handleSignUp]);
  const handleSignOut = useCallback(() => { auth.signOut(); setUser(null); }, []);

  const filtered = useMemo(() => AFRICAN_ANIMALS.filter(a => 
    (filter === 'all' || a.category.toLowerCase() === filter) &&
    a.name.toLowerCase().includes(search.toLowerCase())
  ), [filter, search]);

  const paginated = useMemo(() => filtered.slice(page * 48, (page + 1) * 48), [filtered, page]);

  const startSafari = (dest) => {
    if (isTimeLimitReached) { setShowAuthGate(true); return; }
    setSafari(dest); setProgress(0); updateState({ screen: 'safari' });
    const i = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(i); return 100; } return p + 5; }), 400);
  };

  const completeSafari = () => {
    if (safari && !visited.includes(safari.id)) {
      updateState(prev => ({ ...prev, visited: [...prev.visited, safari.id], points: prev.points + safari.points }));
      setProverb(PROVERBS[Math.floor(Math.random() * PROVERBS.length)]);
    }
    setSafari(null); updateState({ screen: 'home' });
    const a = AFRICAN_ANIMALS[Math.floor(Math.random() * 32)];
    const opts = [a.name, ...AFRICAN_ANIMALS.filter(x => x.id !== a.id).sort(() => Math.random() - 0.5).slice(0, 3).map(x => x.name)].sort(() => Math.random() - 0.5);
    setQuiz({ q: a.fact, answer: a.name, opts });
  };

  const answerQuiz = (ans) => {
    if (ans === quiz.answer) {
      updateState(prev => {
        const newState = { ...prev, points: prev.points + 25, quizzesCorrect: prev.quizzesCorrect + 1 };
        const locked = AFRICAN_ANIMALS.filter(a => !prev.unlocked.includes(a.id));
        if (locked.length && Math.random() > 0.5) newState.unlocked = [...prev.unlocked, locked[Math.floor(Math.random() * locked.length)].id];
        return newState;
      });
    }
    setQuiz(null);
  };

  const setScreen = (s) => updateState({ screen: s });
  const setAnimal = (a) => updateState({ animal: a });
  const setPark = (p) => updateState({ park: p });
  const setKidMode = (k) => updateState({ kidMode: k });

  const S = {
    bg: { minHeight: '100vh', background: 'linear-gradient(135deg, #FFFAF5, #FFF5E6)', fontFamily: "'Nunito', sans-serif" },
    kente: { height: 8, background: 'linear-gradient(90deg, #E8A735, #E86B35, #5A8F3E, #4A90A4, #E8A735)', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 },
    card: { background: 'rgba(255,255,255,0.95)', borderRadius: 20, boxShadow: '0 10px 40px rgba(0,0,0,0.08)', border: '1px solid rgba(232,167,53,0.2)' },
    btn: { background: 'linear-gradient(135deg, #E8A735, #E86B35)', border: 'none', borderRadius: 50, padding: '14px 32px', fontWeight: 700, color: 'white', cursor: 'pointer', boxShadow: '0 4px 15px rgba(232,167,53,0.4)' },
    btnSecondary: { background: 'white', border: '2px solid #E8A735', borderRadius: 50, padding: '12px 28px', fontWeight: 700, color: '#E8A735', cursor: 'pointer' },
    title: { fontFamily: "'Amatic SC', cursive", color: '#1B4D3E' },
    gold: '#E8A735', green: '#5A8F3E', forest: '#1B4D3E',
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 },
    input: { width: '100%', padding: '14px 18px', borderRadius: 12, border: '2px solid #E5E7EB', fontSize: 16, marginBottom: 12 }
  };

  const formatTimeRemaining = () => {
    const remaining = Math.max(0, GUEST_TIME_LIMIT_MS - guestPlaytimeMs);
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const Header = () => (
    <div style={{ position: 'fixed', top: 8, right: 16, zIndex: 101, display: 'flex', gap: 8, alignItems: 'center' }}>
      {!storageAvailable && <span style={{ background: '#FEF3C7', color: '#92400E', padding: '6px 12px', borderRadius: 20, fontSize: 11 }}>⚠️ Private mode</span>}
      {!isAuthenticated && <span style={{ background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: 20, fontSize: 11, color: '#666' }}>⏱️ {formatTimeRemaining()}</span>}
      {user ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'rgba(255,255,255,0.9)', padding: '6px 12px', borderRadius: 20, fontSize: 12, color: S.forest }}>👤 {user.nickname}</span>
          <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>Sign out</button>
        </div>
      ) : (
        <button onClick={() => { setShowAuthModal(true); setAuthMode('signup'); }} style={{ ...S.btnSecondary, padding: '8px 16px', fontSize: 12 }}>Sign up / Log in</button>
      )}
    </div>
  );

  const AuthGate = () => (
    <div style={S.overlay}>
      <div style={{ ...S.card, padding: 40, maxWidth: 450, width: '100%', textAlign: 'center' }}>
        <span style={{ fontSize: '4rem', display: 'block', marginBottom: 16 }}>⏰</span>
        <h2 style={{ ...S.title, fontSize: '2rem', marginBottom: 12 }}>Your Free Safari Ended!</h2>
        <p style={{ color: '#666', marginBottom: 24 }}>You've explored for 10 hours as a guest. Create a free account to continue!</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => { setAuthProvider('nickname'); setShowAuthGate(false); setShowAuthModal(true); }} style={S.btn}>🎮 Continue with Nickname</button>
          <button onClick={() => { setAuthProvider('google'); handleSignUp('google'); }} style={S.btnSecondary}>🔵 Sign up with Google</button>
          <button onClick={() => { setAuthProvider('email'); setShowAuthGate(false); setShowAuthModal(true); }} style={S.btnSecondary}>✉️ Sign up with Email</button>
        </div>
        <p style={{ marginTop: 20, fontSize: 12, color: '#888' }}>Already have an account? <button onClick={() => { setAuthMode('login'); setShowAuthGate(false); setShowAuthModal(true); }} style={{ background: 'none', border: 'none', color: S.gold, cursor: 'pointer', fontWeight: 700 }}>Log in</button></p>
      </div>
    </div>
  );

  const AuthModal = () => (
    <div style={S.overlay} onClick={() => setShowAuthModal(false)}>
      <div style={{ ...S.card, padding: 32, maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ ...S.title, fontSize: '1.8rem', textAlign: 'center', marginBottom: 20 }}>{authMode === 'signup' ? '🌍 Join Safarigam' : '👋 Welcome Back'}</h2>
        {(!authProvider || authProvider === 'nickname') && (
          <div style={{ marginBottom: 16 }}>
            <input type="text" placeholder="Choose a nickname" value={authForm.nickname} onChange={e => setAuthForm(f => ({ ...f, nickname: e.target.value }))} style={S.input} maxLength={20} />
            <button onClick={() => handleSignUp('nickname')} style={{ ...S.btn, width: '100%' }}>🎮 {authMode === 'signup' ? 'Start Playing' : 'Log In'}</button>
          </div>
        )}
        {authProvider === 'email' && (
          <div style={{ marginBottom: 16 }}>
            <input type="text" placeholder="Nickname (optional)" value={authForm.nickname} onChange={e => setAuthForm(f => ({ ...f, nickname: e.target.value }))} style={S.input} />
            <input type="email" placeholder="Email address" value={authForm.email} onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} style={S.input} />
            <input type="password" placeholder="Password" value={authForm.password} onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} style={S.input} />
            <button onClick={() => authMode === 'signup' ? handleSignUp('email') : handleSignIn('email')} style={{ ...S.btn, width: '100%' }}>{authMode === 'signup' ? 'Create Account' : 'Log In'}</button>
          </div>
        )}
        {(!authProvider || authProvider === 'nickname') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}><div style={{ flex: 1, height: 1, background: '#E5E7EB' }} /><span style={{ color: '#888', fontSize: 12 }}>or</span><div style={{ flex: 1, height: 1, background: '#E5E7EB' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => { setAuthProvider('google'); handleSignUp('google'); }} style={{ ...S.btnSecondary, width: '100%' }}>🔵 Continue with Google</button>
              <button onClick={() => setAuthProvider('email')} style={{ ...S.btnSecondary, width: '100%' }}>✉️ Continue with Email</button>
            </div>
          </>
        )}
        <p style={{ marginTop: 20, fontSize: 12, color: '#888', textAlign: 'center' }}>{authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"} <button onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')} style={{ background: 'none', border: 'none', color: S.gold, cursor: 'pointer', fontWeight: 700 }}>{authMode === 'signup' ? 'Log in' : 'Sign up'}</button></p>
        {authProvider && <button onClick={() => setAuthProvider(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12, marginTop: 12, width: '100%' }}>← Back</button>}
      </div>
    </div>
  );

  const AchievementToast = () => achievementToast && (
    <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #1B4D3E, #2D5A27)', color: 'white', padding: '16px 24px', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 12, zIndex: 300, animation: 'slideUp 0.5s ease-out' }}>
      <span style={{ fontSize: '2rem' }}>{achievementToast.icon}</span>
      <div><p style={{ fontWeight: 700, margin: 0 }}>🏆 Achievement Unlocked!</p><p style={{ margin: 0, fontSize: 14, opacity: 0.9 }}>{achievementToast.name}</p></div>
    </div>
  );

  const BottomNav = () => (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #E5E7EB', padding: '8px 16px', zIndex: 50 }}>
      <div style={{ maxWidth: 400, margin: '0 auto', display: 'flex', justifyContent: 'space-around' }}>
        {[{ s: 'home', i: '🏠', l: 'Home' }, { s: 'encyclopedia', i: '📚', l: 'Species' }, { s: 'achievements', i: '🏆', l: 'Badges' }, { s: 'passport', i: '🛂', l: 'Passport' }].map(x => (
          <button key={x.s} onClick={() => setScreen(x.s)} style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 8, cursor: 'pointer', color: screen === x.s ? S.gold : '#666' }}>
            <span style={{ fontSize: '1.5rem' }}>{x.i}</span><span style={{ fontSize: 10 }}>{x.l}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ==================== SCREENS ====================
  if (screen === 'welcome') return (
    <div style={{ ...S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;600;700&display=swap'); @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } } @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
      <div style={S.kente} /><Header />
      <h1 style={{ ...S.title, fontSize: 'clamp(3rem, 8vw, 5rem)', margin: '20px 0 0' }}>🌍 SAFARIGAM 🦁</h1>
      <p style={{ background: 'linear-gradient(90deg, #E8A735, #E86B35)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: 'clamp(1rem, 3vw, 1.5rem)', fontWeight: 700 }}>1000 African Species Adventure</p>
      <p style={{ color: '#888', fontSize: 14 }}>safarigam.com</p>
      <div style={{ ...S.card, padding: 32, maxWidth: 450, width: '100%', marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: '2.5rem', marginBottom: 24 }}>{['🐘', '🦒', '🦓', '🦁'].map((e, i) => <span key={i} style={{ animation: `float 3s ease-in-out infinite ${i * 0.3}s` }}>{e}</span>)}</div>
        <p style={{ textAlign: 'center', color: '#555', marginBottom: 24 }}>Explore Africa's extraordinary biodiversity with 1000 species.</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
          <span style={{ fontSize: 14, fontWeight: kidMode ? 400 : 700 }}>Explorer</span>
          <button onClick={() => setKidMode(!kidMode)} style={{ width: 56, height: 28, borderRadius: 14, border: 'none', background: kidMode ? S.gold : S.green, position: 'relative', cursor: 'pointer' }}><div style={{ width: 22, height: 22, background: 'white', borderRadius: '50%', position: 'absolute', top: 3, transition: 'transform 0.3s', transform: kidMode ? 'translateX(30px)' : 'translateX(4px)' }} /></button>
          <span style={{ fontSize: 14, fontWeight: kidMode ? 700 : 400 }}>Kids</span>
        </div>
        <button onClick={() => setScreen('selectAnimal')} style={{ ...S.btn, width: '100%', fontSize: 18 }}>🌟 Begin Your Adventure</button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 20, textAlign: 'center' }}>{[{ v: '1000', l: 'Species', c: S.gold }, { v: '10', l: 'Parks', c: S.green }, { v: '6', l: 'Destinations', c: '#4A90A4' }, { v: '∞', l: 'Fun', c: '#E86B35' }].map((x, i) => <div key={i}><p style={{ fontSize: '1.5rem', fontWeight: 700, color: x.c, margin: 0 }}>{x.v}</p><p style={{ fontSize: 10, color: '#888', margin: 0 }}>{x.l}</p></div>)}</div>
      </div>
      <p style={{ marginTop: 24, color: '#666', fontStyle: 'italic', textAlign: 'center' }}>"Motho ke motho ka batho" — I am because we are</p>
      {showAuthGate && <AuthGate />}{showAuthModal && <AuthModal />}<AchievementToast />
    </div>
  );

  if (screen === 'selectAnimal') return (
    <div style={{ ...S.bg, padding: 20, paddingTop: 60 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;600;700&display=swap'); @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
      <div style={S.kente} /><Header />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => setScreen('welcome')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: 16 }}>← Back</button>
        <h2 style={{ ...S.title, fontSize: '2.5rem', textAlign: 'center' }}>🦁 Choose Your Companion</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 24 }}>{unlocked.length} unlocked of 1000 species</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
          {AFRICAN_ANIMALS.filter(a => unlocked.includes(a.id)).slice(0, 24).map(a => (
            <div key={a.id} onClick={() => { setAnimal(a); setScreen('selectPark'); }} style={{ ...S.card, padding: 16, textAlign: 'center', cursor: 'pointer', transition: 'transform 0.3s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <span style={{ fontSize: '2.5rem' }}>{a.emoji}</span>
              <p style={{ fontWeight: 700, fontSize: 12, color: S.forest, margin: '8px 0 0' }}>{a.name}</p>
              <p style={{ fontSize: 10, color: '#888', margin: 0 }}>{a.category}</p>
            </div>
          ))}
        </div>
      </div>
      {showAuthGate && <AuthGate />}{showAuthModal && <AuthModal />}<AchievementToast />
    </div>
  );

  if (screen === 'selectPark') return (
    <div style={{ ...S.bg, padding: 20, paddingTop: 60 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;600;700&display=swap');`}</style>
      <div style={S.kente} /><Header />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => setScreen('selectAnimal')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: 16 }}>← Change Animal</button>
        <div style={{ ...S.card, padding: 16, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: '3rem' }}>{animal?.emoji}</span>
          <div><p style={{ fontWeight: 700, color: S.forest, margin: 0 }}>{animal?.name}</p><p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>{animal?.fact}</p></div>
        </div>
        <h2 style={{ ...S.title, fontSize: '2.5rem', textAlign: 'center', marginBottom: 24 }}>🏞️ Select Your Home Base</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {AFRICAN_PARKS.map(p => (
            <div key={p.id} onClick={() => { setPark(p); setScreen('home'); }} style={{ ...S.card, padding: 20, cursor: 'pointer', borderLeft: `4px solid ${p.color}`, transition: 'transform 0.3s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <p style={{ fontWeight: 700, color: S.forest, margin: 0 }}>{p.name}</p>
              <p style={{ fontSize: 12, color: '#888', margin: '4px 0 8px' }}>📍 {p.country}</p>
              <p style={{ fontSize: 13, color: '#666', margin: 0 }}>{p.description}</p>
            </div>
          ))}
        </div>
      </div>
      {showAuthGate && <AuthGate />}{showAuthModal && <AuthModal />}<AchievementToast />
    </div>
  );

  if (screen === 'safari') return (
    <div style={{ ...S.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;600;700&display=swap'); @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
      <div style={S.kente} /><Header />
      <div style={{ ...S.card, padding: 40, maxWidth: 500, width: '100%', textAlign: 'center' }}>
        <span style={{ fontSize: '4rem', display: 'block', marginBottom: 16, animation: 'float 3s ease-in-out infinite' }}>{animal?.emoji}</span>
        <h2 style={{ ...S.title, fontSize: '2rem', marginBottom: 8 }}>Safari to {safari?.name}</h2>
        <p style={{ color: '#666', marginBottom: 24 }}>{safari?.description}</p>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}><span>Journey Progress</span><span>{progress}%</span></div>
          <div style={{ width: '100%', background: '#E5E7EB', borderRadius: 10, height: 16 }}><div style={{ background: 'linear-gradient(90deg, #5A8F3E, #E8A735)', borderRadius: 10, height: 16, width: `${progress}%`, transition: 'width 0.3s' }} /></div>
        </div>
        {progress < 100 ? <p style={{ fontSize: 14, color: '#888' }}>{progress < 50 ? `Departing from ${park?.name}...` : `Approaching ${safari?.name}...`}</p> : (
          <div>
            <p style={{ color: '#065F46', fontWeight: 700, marginBottom: 16 }}>🎉 You've arrived!</p>
            <button onClick={completeSafari} style={{ ...S.btn, width: '100%', marginBottom: 12 }}>Return to {park?.name} 🏠</button>
            <p style={{ fontSize: 14, color: S.gold, fontWeight: 700 }}>+{safari?.points} Ulimanta Points!</p>
          </div>
        )}
      </div>
      {showAuthGate && <AuthGate />}{showAuthModal && <AuthModal />}<AchievementToast />
    </div>
  );

  if (screen === 'achievements') return (
    <div style={{ ...S.bg, padding: 20, paddingTop: 60, paddingBottom: 100 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;600;700&display=swap');`}</style>
      <div style={S.kente} /><Header />
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <button onClick={() => setScreen('home')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: 16 }}>← Home</button>
        <h2 style={{ ...S.title, fontSize: '2.5rem', textAlign: 'center' }}>🏆 Achievements</h2>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: 24 }}>{earnedAchievements.length} of {ACHIEVEMENTS.length} unlocked</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {ACHIEVEMENTS.map(a => {
            const earned = earnedAchievements.includes(a.id);
            return (
              <div key={a.id} style={{ ...S.card, padding: 20, textAlign: 'center', opacity: earned ? 1 : 0.5 }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8, filter: earned ? 'none' : 'grayscale(100%)' }}>{a.icon}</span>
                <p style={{ fontWeight: 700, color: earned ? S.forest : '#888', margin: 0 }}>{a.name}</p>
                <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{a.description}</p>
                {earned && <span style={{ display: 'inline-block', marginTop: 8, padding: '4px 12px', fontSize: 10, borderRadius: 20, background: '#D1FAE5', color: '#065F46' }}>✓ Unlocked</span>}
              </div>
            );
          })}
        </div>
        <h3 style={{ ...S.title, fontSize: '1.8rem', textAlign: 'center', marginTop: 40, marginBottom: 16 }}>⭐ Point Badges</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {Array.from({ length: Math.min(Math.floor(points / 100), 20) }, (_, i) => <span key={i} style={{ fontSize: '2rem' }}>⭐</span>)}
          {points < 100 && <p style={{ color: '#888' }}>Earn 100 points for your first badge!</p>}
        </div>
      </div>
      <BottomNav />{showAuthGate && <AuthGate />}{showAuthModal && <AuthModal />}<AchievementToast />
    </div>
  );

  if (screen === 'encyclopedia') return (
    <div style={{ ...S.bg, padding: 20, paddingTop: 60, paddingBottom: 100 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;600;700&display=swap');`}</style>
      <div style={S.kente} /><Header />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => setScreen('home')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: 16 }}>← Home</button>
        <h2 style={{ ...S.title, fontSize: '2.5rem', textAlign: 'center' }}>📚 Species Encyclopedia</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <input type="text" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ padding: '12px 20px', borderRadius: 25, border: '2px solid #E5E7EB', width: 220 }} />
          <select value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }} style={{ padding: '12px 20px', borderRadius: 25, border: '2px solid #E5E7EB', background: 'white' }}>
            <option value="all">All</option><option value="mammal">Mammals</option><option value="bird">Birds</option><option value="reptile">Reptiles</option><option value="amphibian">Amphibians</option><option value="fish">Fish</option><option value="invertebrate">Invertebrates</option>
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {paginated.map(a => {
            const isUnlocked = unlocked.includes(a.id);
            return (
              <div key={a.id} style={{ ...S.card, padding: 12, textAlign: 'center', opacity: isUnlocked ? 1 : 0.5 }}>
                <span style={{ fontSize: isUnlocked ? '2rem' : '1.5rem' }}>{isUnlocked ? a.emoji : '🔒'}</span>
                <p style={{ fontWeight: 600, fontSize: 11, color: S.forest, margin: '4px 0 0' }}>{a.name}</p>
                <p style={{ fontSize: 9, color: '#888', margin: 0 }}>{a.category}</p>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ ...S.btn, padding: '10px 20px', fontSize: 14, opacity: page === 0 ? 0.5 : 1 }}>← Prev</button>
          <button onClick={() => setPage(p => Math.min(Math.ceil(filtered.length / 48) - 1, p + 1))} disabled={page >= Math.ceil(filtered.length / 48) - 1} style={{ ...S.btn, padding: '10px 20px', fontSize: 14, opacity: page >= Math.ceil(filtered.length / 48) - 1 ? 0.5 : 1 }}>Next →</button>
        </div>
      </div>
      <BottomNav />{showAuthGate && <AuthGate />}{showAuthModal && <AuthModal />}<AchievementToast />
    </div>
  );

  if (screen === 'passport') return (
    <div style={{ ...S.bg, padding: 20, paddingTop: 60, paddingBottom: 100 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;600;700&display=swap');`}</style>
      <div style={S.kente} /><Header />
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <button onClick={() => setScreen('home')} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', marginBottom: 16 }}>← Home</button>
        <div style={{ ...S.card, padding: 32, textAlign: 'center' }}>
          <span style={{ fontSize: '4rem' }}>🛂</span>
          <h2 style={{ ...S.title, fontSize: '2.5rem', marginTop: 16 }}>Safari Passport</h2>
          {user && <p style={{ color: S.forest, fontWeight: 700, marginTop: 8 }}>👤 {user.nickname}</p>}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, margin: '24px 0' }}>
            <div><p style={{ fontSize: '2rem', fontWeight: 700, color: S.gold, margin: 0 }}>{visited.length}</p><p style={{ fontSize: 12, color: '#888', margin: 0 }}>Destinations</p></div>
            <div><p style={{ fontSize: '2rem', fontWeight: 700, color: S.green, margin: 0 }}>{points}</p><p style={{ fontSize: 12, color: '#888', margin: 0 }}>Points</p></div>
            <div><p style={{ fontSize: '2rem', fontWeight: 700, color: '#4A90A4', margin: 0 }}>{earnedAchievements.length}</p><p style={{ fontSize: 12, color: '#888', margin: 0 }}>Achievements</p></div>
          </div>
          <h3 style={{ ...S.title, fontSize: '1.5rem', marginBottom: 16 }}>Stamps Collected</h3>
          {visited.length === 0 ? <p style={{ color: '#888' }}>No stamps yet!</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
              {visited.map(id => { const d = GLOBAL_DESTINATIONS.find(x => x.id === id); return d ? <div key={id} style={{ padding: 16, background: `${d.color}22`, borderRadius: 12, border: `2px solid ${d.color}` }}><p style={{ fontWeight: 700, fontSize: 12, color: S.forest, margin: 0 }}>{d.name}</p></div> : null; })}
            </div>
          )}
        </div>
      </div>
      <BottomNav />{showAuthGate && <AuthGate />}{showAuthModal && <AuthModal />}<AchievementToast />
    </div>
  );

  // HOME SCREEN
  return (
    <div style={{ ...S.bg, padding: 20, paddingTop: 60, paddingBottom: 100 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&family=Nunito:wght@400;600;700&display=swap'); @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
      <div style={S.kente} /><Header />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '2.5rem' }}>{animal?.emoji}</span>
            <div><p style={{ fontWeight: 700, color: S.forest, margin: 0, fontSize: '1.2rem' }}>{animal?.name}</p><p style={{ fontSize: 11, color: '#888', margin: 0 }}>Home: {park?.name}</p></div>
          </div>
          <div style={{ ...S.card, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.5rem' }}>✨</span>
            <div><p style={{ fontSize: 10, color: '#888', margin: 0 }}>Ulimanta Points</p><p style={{ fontWeight: 700, fontSize: '1.2rem', margin: 0, color: S.gold }}>{points}</p></div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[{ i: '🛂', v: visited.length, l: 'Destinations' }, { i: '📚', v: unlocked.length, l: 'Species', onClick: () => setScreen('encyclopedia') }, { i: '🏆', v: earnedAchievements.length, l: 'Achievements', onClick: () => setScreen('achievements') }, { i: '🎯', v: '1000', l: 'Total Species' }].map((x, i) => (
            <div key={i} onClick={x.onClick} style={{ ...S.card, padding: 16, textAlign: 'center', cursor: x.onClick ? 'pointer' : 'default', transition: 'transform 0.3s' }} onMouseEnter={e => x.onClick && (e.currentTarget.style.transform = 'scale(1.05)')} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <p style={{ fontSize: '1.8rem', margin: '0 0 4px' }}>{x.i}</p>
              <p style={{ fontWeight: 700, color: S.forest, margin: 0 }}>{x.v}</p>
              <p style={{ fontSize: 10, color: '#888', margin: 0 }}>{x.l}</p>
            </div>
          ))}
        </div>
        <h3 style={{ ...S.title, fontSize: '2rem', marginBottom: 16 }}>🌍 Global Safaris</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
          {GLOBAL_DESTINATIONS.map(d => {
            const v = visited.includes(d.id);
            return (
              <div key={d.id} onClick={() => !v && startSafari(d)} style={{ ...S.card, padding: 20, borderTop: `4px solid ${d.color}`, opacity: v ? 0.7 : 1, cursor: v ? 'default' : 'pointer', transition: 'transform 0.3s' }} onMouseEnter={e => !v && (e.currentTarget.style.transform = 'translateY(-5px)')} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <p style={{ fontWeight: 700, color: S.forest, margin: 0 }}>{d.name}</p>
                  {v && <span style={{ color: '#10B981', fontSize: '1.2rem' }}>✓</span>}
                </div>
                <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px' }}>📍 {d.region}</p>
                <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>{d.description}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 4 }}>{d.keySpecies.slice(0, 2).map((s, i) => <span key={i} style={{ fontSize: 10, padding: '2px 8px', background: '#F3F4F6', borderRadius: 20 }}>{s}</span>)}</div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: S.gold }}>+{d.points} pts</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />
      {quiz && (
        <div style={S.overlay}>
          <div style={{ ...S.card, padding: 32, maxWidth: 400, width: '100%' }}>
            <h3 style={{ ...S.title, fontSize: '1.5rem', textAlign: 'center', marginBottom: 16 }}>🧠 Wildlife Quiz!</h3>
            <p style={{ color: '#555', marginBottom: 24, textAlign: 'center' }}>Which animal: {quiz.q}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {quiz.opts.map((o, i) => <button key={i} onClick={() => answerQuiz(o)} style={{ padding: '12px 16px', borderRadius: 12, border: '2px solid #E5E7EB', background: 'white', cursor: 'pointer', textAlign: 'left' }}>{o}</button>)}
            </div>
            <button onClick={() => setQuiz(null)} style={{ marginTop: 16, color: '#888', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'center', fontSize: 13 }}>Skip</button>
          </div>
        </div>
      )}
      {proverb && (
        <div style={S.overlay}>
          <div style={{ ...S.card, padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem' }}>🌟</span>
            <h3 style={{ ...S.title, fontSize: '1.5rem', marginTop: 16, marginBottom: 16 }}>Safari Complete!</h3>
            <p style={{ fontSize: '1.1rem', fontStyle: 'italic', color: '#8B5A2B', marginBottom: 8 }}>"{proverb.text}"</p>
            <p style={{ color: '#666', marginBottom: 16 }}>{proverb.translation}</p>
            <button onClick={() => setProverb(null)} style={S.btn}>Continue</button>
          </div>
        </div>
      )}
      {showAuthGate && <AuthGate />}{showAuthModal && <AuthModal />}<AchievementToast />
    </div>
  );
};

export default Safarigam;
