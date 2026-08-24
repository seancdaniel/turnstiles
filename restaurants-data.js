/* Turnstiles - curated dining locations, one list per park/resort (same pattern
   as RIDES_BY_PARK in supabase-waittimes.js). Keys must match the <option> text
   in the food review form's "Park or Resort" select (#fr-park) exactly.

   Each entry is a [name, type] pair. type is one of:
     'table' - sit-down / table service restaurant
     'quick' - quick / counter service
     'snack' - a named snack, treat, or walk-up spot (not a generic unnamed cart)

   Curated from general knowledge, not pulled live from Disney/Universal's own
   dining pages - restaurants open, close, and get renamed often enough that
   this WILL drift out of date over time. Epic Universe (opened 2025) is the
   least certain theme-park section since it's the newest park, and Disney
   Springs is its own risk for a different reason - its restaurant lineup
   rotates more often than an actual theme park's does. If a user says a spot
   is missing, closed, or misnamed, that's real - just add/edit/remove the
   entry below and bump every ?v= that loads this file (see index.html).
   No schema change needed either way: this only feeds the picker, the actual
   choice still just gets written into food_reviews.spot as plain text, same
   as it always has. */

var RESTAURANTS_BY_PARK = {
  'Magic Kingdom': [
    ['Be Our Guest Restaurant', 'table'],
    ["Cinderella's Royal Table", 'table'],
    ['The Crystal Palace', 'table'],
    ['Jungle Navigation Co. Ltd. Skipper Canteen', 'table'],
    ['Liberty Tree Tavern', 'table'],
    ["Tony's Town Square Restaurant", 'table'],
    ['The Plaza Restaurant', 'table'],
    ["Casey's Corner", 'quick'],
    ['Columbia Harbour House', 'quick'],
    ["Cosmic Ray's Starlight Café", 'quick'],
    ["Friar's Nook", 'quick'],
    ['Golden Oak Outpost', 'quick'],
    ["Pecos Bill Tall Tale Inn and Café", 'quick'],
    ['Pinocchio Village Haus', 'quick'],
    ['The Diamond Horseshoe', 'quick'],
    ['Aloha Isle', 'snack'],
    ['Sunshine Tree Terrace', 'snack'],
    ["Gaston's Tavern", 'snack'],
    ['The Lunching Pad', 'snack'],
    ['Sleepy Hollow Refreshments', 'snack'],
    ['Storybook Treats', 'snack'],
    ["Auntie Gravity's Galactic Goodies", 'snack'],
    ["Prince Eric's Village Market", 'snack'],
    ['Westward Ho', 'snack'],
    ['Cheshire Café', 'snack']
  ],
  'EPCOT': [
    ['Space 220 Restaurant', 'table'],
    ['Le Cellier Steakhouse', 'table'],
    ['Chefs de France', 'table'],
    ['Coral Reef Restaurant', 'table'],
    ['Garden Grill Restaurant', 'table'],
    ['Akershus Royal Banquet Hall', 'table'],
    ['Biergarten Restaurant', 'table'],
    ['San Angel Inn Restaurante', 'table'],
    ['Rose & Crown Dining Room', 'table'],
    ['Tutto Italia Ristorante', 'table'],
    ['Spice Road Table', 'table'],
    ['Teppan Edo', 'table'],
    ['Tokyo Dining', 'table'],
    ['Nine Dragons Restaurant', 'table'],
    ['Sunshine Seasons', 'quick'],
    ['Regal Eagle Smokehouse', 'quick'],
    ['Connections Eatery', 'quick'],
    ['La Cantina de San Angel', 'quick'],
    ['Katsura Grill', 'quick'],
    ['Lotus Blossom Café', 'quick'],
    ['Yorkshire County Fish Shop', 'quick'],
    ['Refreshment Port', 'quick'],
    ['Les Halles Boulangerie-Patisserie', 'quick'],
    ['Tangierine Café', 'quick'],
    ["L'Artisan des Glaces", 'snack'],
    ['Kringla Bakeri Og Kafe', 'snack'],
    ['Refreshment Cool Post', 'snack'],
    ['Fife & Drum Tavern', 'snack'],
    ['Joy of Tea', 'snack'],
    ['Karamell-Küche', 'snack']
  ],
  'Hollywood Studios': [
    ['Hollywood Brown Derby', 'table'],
    ["50's Prime Time Café", 'table'],
    ["Mama Melrose's Ristorante Italiano", 'table'],
    ['Sci-Fi Dine-In Theater Restaurant', 'table'],
    ["Oga's Cantina", 'table'],
    ['ABC Commissary', 'quick'],
    ['Backlot Express', 'quick'],
    ['Docking Bay 7 Food and Cargo', 'quick'],
    ["Woody's Lunch Box", 'quick'],
    ["Catalina Eddie's", 'quick'],
    ["Rosie's All-American Café", 'quick'],
    ['Fairfax Fare', 'quick'],
    ['PizzeRizzo', 'quick'],
    ['Milk Stand', 'snack'],
    ['Ronto Roasters', 'snack'],
    ['Dockside Diner', 'snack'],
    ['Trolley Car Café', 'snack']
  ],
  'Animal Kingdom': [
    ['Tiffins Restaurant', 'table'],
    ['Tusker House Restaurant', 'table'],
    ['Yak & Yeti Restaurant', 'table'],
    ['Rainforest Cafe', 'table'],
    ['Flame Tree Barbecue', 'quick'],
    ["Satu'li Canteen", 'quick'],
    ['Pizzafari', 'quick'],
    ['Restaurantosaurus', 'quick'],
    ['Yak & Yeti Local Food Cafes', 'quick'],
    ['Harambe Market', 'quick'],
    ['Isle of Java', 'snack'],
    ['Dino-Bite Snacks', 'snack'],
    ['Trilo-Bites', 'snack'],
    ['Nomad Lounge', 'snack'],
    ['Pongu Pongu', 'snack']
  ],
  'Universal Studios Florida': [
    ["Finnegan's Bar & Grill", 'table'],
    ["Lombard's Seafood Grille", 'table'],
    ['Leaky Cauldron', 'table'],
    ["Louie's Italian Restaurant", 'quick'],
    ["Mel's Drive-In", 'quick'],
    ['Monsters Café', 'quick'],
    ['KidZone Pizza Company', 'quick'],
    ['Krusty Burger', 'quick'],
    ["Luigi's Pizza", 'quick'],
    ["Moe's Tavern", 'quick'],
    ['Duff Brewery', 'quick'],
    ["Cletus' Chicken Shack", 'quick'],
    ['San Francisco Pastry Company', 'snack'],
    ['Central Park Crepes', 'snack'],
    ['The Hopping Pot', 'snack'],
    ["Florean Fortescue's Ice-Cream Parlour", 'snack']
  ],
  'Islands of Adventure': [
    ['Mythos Restaurant', 'table'],
    ['Confisco Grille', 'table'],
    ['Three Broomsticks', 'quick'],
    ['Thunder Falls Terrace', 'quick'],
    ['Captain America Diner', 'quick'],
    ['Wimpy\'s', 'quick'],
    ['Burger Digs', 'quick'],
    ['Pizza Predattoria', 'quick'],
    ['Comic Strip Café', 'quick'],
    ['Green Eggs and Ham Café', 'quick'],
    ["Hog's Head Pub", 'snack'],
    ["Fire-Eater's Grill", 'snack'],
    ['Cinnabon', 'snack']
  ],
  'Epic Universe': [
    ['Atlantic', 'table'],
    ['The Curious Cask', 'table'],
    ['Toadstool Cafe', 'quick'],
    ['Neighborhood Bakery', 'quick'],
    ["Yoshi's Snack Island", 'snack'],
    ['Mead Hall', 'quick'],
    ['The Burning Blade', 'quick']
  ],
  'Blizzard Beach': [
    ['Lottawatta Lodge', 'quick'],
    ['Avalunch', 'quick'],
    ['Warming Hut', 'quick'],
    ['The Polar Pub', 'snack'],
    ['I C E Station Cool', 'snack']
  ],
  'Typhoon Lagoon': [
    ['Leaning Palms', 'quick'],
    ["Typhoon Tilly's Galley & Grog", 'quick'],
    ['Happy Landings Ice Cream', 'snack'],
    ["Let's Go Slurpin'", 'snack']
  ],
  'Volcano Bay': [
    ['Kohola Reef Restaurant & Social Club', 'quick'],
    ['Bambu', 'quick'],
    ['Whakawaiwai Eats', 'quick'],
    ['Kunuku Boat Bar', 'snack'],
    ['Dancing Dragons Boat Bar', 'snack']
  ],
  'Disney Springs': [
    ['The Boathouse', 'table'],
    ["Chef Art Smith's Homecomin'", 'table'],
    ['Morimoto Asia', 'table'],
    ['Paddlefish', 'table'],
    ['Raglan Road Irish Pub and Restaurant', 'table'],
    ['STK Orlando', 'table'],
    ['Terralina Crafted Italian', 'table'],
    ['The Edison', 'table'],
    ['Jaleo by José Andrés', 'table'],
    ["Maria & Enzo's Ristorante", 'table'],
    ["Enzo's Hideaway", 'table'],
    ['Wine Bar George', 'table'],
    ['City Works Eatery & Pour House', 'table'],
    ['Planet Hollywood', 'table'],
    ['Rainforest Cafe', 'table'],
    ['T-REX', 'table'],
    ['House of Blues Restaurant & Bar', 'table'],
    ['Frontera Cocina', 'table'],
    ['The Polite Pig', 'table'],
    ['Splitsville Luxury Lanes', 'table'],
    ["Blaze Fast-Fire'd Pizza", 'quick'],
    ['Chicken Guy!', 'quick'],
    ['The Daily Poutine', 'quick'],
    ['Earl of Sandwich', 'quick'],
    ["Wetzel's Pretzels", 'quick'],
    ['Cookes of Dublin', 'quick'],
    ['Pizza Ponte', 'quick'],
    ['D-Luxe Burger', 'quick'],
    ["B.B. Wolf's Sausage Co.", 'quick'],
    ['Wolfgang Puck Express', 'quick'],
    ['Starbucks', 'quick'],
    ['Vivoli il Gelato', 'snack'],
    ["Amorette's Patisserie", 'snack'],
    ['Sprinkles', 'snack'],
    ["Erin McKenna's Bakery", 'snack'],
    ['Ghirardelli Soda Fountain and Chocolate Shop', 'snack'],
    ['Joffrey\'s Coffee & Tea Company', 'snack'],
    ['Aristocrepes', 'snack']
  ],
  "Disney's Animal Kingdom Lodge": [
    ['Jiko - The Cooking Place', 'table'],
    ['Boma - Flavors of Africa', 'table'],
    ['The Mara', 'quick']
  ],
  "Disney's Beach Club Resort": [
    ['Cape May Café', 'table'],
    ['Beaches & Cream Soda Shop', 'table'],
    ['Beach Club Marketplace', 'quick']
  ],
  "Disney's BoardWalk Inn": [
    ['Trattoria al Forno', 'table'],
    ['Flying Fish', 'table'],
    ['Belle Vue Room', 'table'],
    ['BoardWalk Bakery', 'quick']
  ],
  "Disney's Contemporary Resort": [
    ['California Grill', 'table'],
    ["Chef Mickey's", 'table'],
    ['Steakhouse 71', 'table'],
    ['Contempo Café', 'quick']
  ],
  "Disney's Grand Floridian Resort & Spa": [
    ["Victoria & Albert's", 'table'],
    ["Narcoossee's", 'table'],
    ['1900 Park Fare', 'table'],
    ['Grand Floridian Café', 'table'],
    ['Citricos', 'table'],
    ['Gasparilla Island Grill', 'quick']
  ],
  "Disney's Polynesian Village Resort": [
    ["'Ohana", 'table'],
    ['Kona Café', 'table'],
    ["Capt. Cook's", 'quick']
  ],
  "Disney's Riviera Resort": [
    ["Topolino's Terrace", 'table'],
    ['Primo Piatto', 'quick']
  ],
  "Disney's Wilderness Lodge": [
    ['Whispering Canyon Cafe', 'table'],
    ['Artist Point', 'table'],
    ['Geyser Point Bar & Grill', 'quick'],
    ['Roaring Fork', 'quick']
  ],
  "Disney's Yacht Club Resort": [
    ['Yachtsman Steakhouse', 'table'],
    ['Ale & Compass Restaurant', 'table'],
    ['Yacht Club Galley', 'quick']
  ],
  "Disney's Caribbean Beach Resort": [
    ["Sebastian's Bistro", 'table'],
    ['Centertown Market', 'quick']
  ],
  "Disney's Coronado Springs Resort": [
    ['Toledo - Tapas, Steak & Seafood', 'table'],
    ['Three Bridges Bar & Grill', 'table'],
    ['Maya Grill', 'table'],
    ['Pepper Market', 'quick']
  ],
  "Disney's Port Orleans - French Quarter": [
    ['Sassagoula Floatworks and Food Factory', 'quick']
  ],
  "Disney's Port Orleans - Riverside": [
    ["Boatwright's Dining Hall", 'table'],
    ['Riverside Mill Food Court', 'quick']
  ],
  "Disney's All-Star Movies Resort": [
    ['World Premiere Food Court', 'quick']
  ],
  "Disney's All-Star Music Resort": [
    ['Intermission Food Court', 'quick']
  ],
  "Disney's All-Star Sports Resort": [
    ['End Zone Food Court', 'quick']
  ],
  "Disney's Art of Animation Resort": [
    ['Landscape of Flavors', 'quick']
  ],
  "Disney's Pop Century Resort": [
    ['Everything Pop Shopping & Dining', 'quick']
  ],
  "Disney's Fort Wilderness Resort & Campground": [
    ["Trail's End Restaurant", 'table'],
    ['Hoop-Dee-Doo Musical Revue', 'table']
  ],
  'Walt Disney World Swan & Dolphin': [
    ["Todd English's bluezoo", 'table'],
    ["Shula's Steak House", 'table'],
    ['Il Mulino', 'table'],
    ['Fresh Mediterranean Market', 'table']
  ]
};

var DINING_TYPE_LABELS = { table: 'Table Service', quick: 'Quick Service', snack: 'Snacks & Walk-Up' };
