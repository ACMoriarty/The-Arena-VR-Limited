/* ==========================================================================
   THE ARENA — SITE CONFIGURATION
   --------------------------------------------------------------------------
   This is the ONLY file you need to edit to change prices, games, opening
   hours, contact details or payment keys. Nothing else in the site hardcodes
   a number.

   >>> BEFORE GOING LIVE, CHANGE THE THREE THINGS MARKED  ### TODO ###  <<<
   ========================================================================== */

window.ARENA = {

  /* ---------------------------------------------------------------------
     1. BUSINESS DETAILS
     --------------------------------------------------------------------- */
  business: {
    name:      'The Arena VR Limited',
    short:     'The Arena',
    address:   '85 Boundary Road, GRA, Benin City',
    state:     'Edo State, Nigeria',
    phone:     '08067289880',
    phoneIntl: '+2348067289880',      // used for tel: and wa.me links
    whatsapp:  '2348067289880',       // wa.me/<this>
    email:     'thisisyourarena@gmail.com',
    instagram: 'https://instagram.com/thearenavr',   // ### TODO ###
    tiktok:    'https://tiktok.com/@thearenavr',     // ### TODO ###
    x:         'https://x.com/thearenavr',           // ### TODO ###
    hours: [
      /* Display only — keep in step with booking.schedule below. */
      { days:'Monday – Friday',    time:'10:00am – 7:00pm' },
      { days:'Saturday',           time:'10:00am – 9:00pm' },
      { days:'Sunday',             time:'12:00pm – 9:00pm' }
    ],

    /* Areas of Benin City, used by the booking form and by the Director's
       "region with the most customers" report. Add or rename freely. */
    areas: [
      'GRA', 'Ugbowo', 'Ikpoba Hill', 'Sapele Road', 'Airport Road',
      'Uselu', 'Sakponba', 'Ekenwan', 'Oluku', 'Ring Road', 'Egor',
      'Other / outside Benin'
    ]
  },

  /* ---------------------------------------------------------------------
     2. PAYMENTS — PAYSTACK
     ---------------------------------------------------------------------
     Get your key at dashboard.paystack.com > Settings > API Keys & Webhooks.
     Use the pk_test_... key while testing, swap to pk_live_... when ready.
     The PUBLIC key is safe to sit in this file. NEVER put a secret key here.
     --------------------------------------------------------------------- */
  paystack: {
    /* OFF for now: bookings are sent to the team on WhatsApp instead of being
       paid online (see booking.whatsappTo). Set to true to bring the Paystack
       checkout back, and restore the Paystack <script> line in book.html. */
    enabled:   false,
    publicKey: 'pk_test_REPLACE_WITH_YOUR_PAYSTACK_PUBLIC_KEY',  // ### TODO ###
    currency:  'NGN',
    /* Set to false once a real key is in place. While true, the "Pay" button
       runs a simulated success so you can click through the whole flow. */
    demoMode:  true
  },

  /* ---------------------------------------------------------------------
     3. CLOUD  —  makes bookings and logins work ACROSS DEVICES
     ---------------------------------------------------------------------
     Leave these blank and everything still works, but each browser only sees
     its own data (a booking made on a customer's phone will not show on your
     laptop dashboard).

     Fill them in and bookings, costs and admin logins are shared by every
     device, and the admin password becomes properly enforced by the server
     instead of only by the page.

     Free to set up. Follow "Cross-device setup" in README.md — it is one SQL
     script and these two values, both taken from your Supabase project under
     Settings → API.

     The anon key below is SAFE to publish: it only identifies the project.
     What anyone may actually read or write is decided by the security rules
     in the SQL script. Never put the `service_role` key here.
     --------------------------------------------------------------------- */
  cloud: {
    url:     'https://buibrsjgtsxhnpkcqbcc.supabase.co',   // e.g. 'https://abcdefgh.supabase.co'
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aWJyc2pndHN4aG5wa2NxYmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTQ2MjAsImV4cCI6MjEwODc3MDYyMH0.d8xCMG7YBT9xg8b1gZfdxvJWU1_QD5AnvE1tRYjEOSk'    // the long "anon / public" key
  },

  /* ---------------------------------------------------------------------
     4. BOOKING RULES
     --------------------------------------------------------------------- */
  booking: {
    /* Opening hours per weekday, 0 = Sunday … 6 = Saturday.
       null means closed that day — no slots are offered at all.
       A session is only offered if it can finish before `close`. */
    schedule: {
      0: { open: 12, close: 21 },   // Sunday    12pm – 9pm
      1: { open: 10, close: 19 },   // Monday    10am – 7pm
      2: { open: 10, close: 19 },   // Tuesday
      3: { open: 10, close: 19 },   // Wednesday
      4: { open: 10, close: 19 },   // Thursday
      5: { open: 10, close: 19 },   // Friday
      6: { open: 10, close: 21 }    // Saturday  10am – 9pm
    },
    slotMinutes: 30,  // granularity of the time picker
    maxDaysAhead: 30, // how far in advance people may book
    maxPlayers:  12,
    /* Optional flat booking/service fee added to every order. 0 = none. */
    serviceFee: 0,

    /* While online payment is off, a finished booking is sent as a WhatsApp
       message to each of these numbers (international format, no + or spaces). */
    whatsappTo: [
      '2348067289880',   // 0806 728 9880
      '2348109156723',   // 0810 915 6723
      '2347079901516'    // 0707 990 1516
    ],

    /* Ask the customer to pick a specific game/playlist when booking.
       false = they just pick the activity; the game is chosen on the day. */
    pickGame: false,

    /* Show the FIFA / Karaoke Challenge events in the booking form.
       false = customers can only book the five main activities. */
    showEvents: false,

    /* Free extra a customer can tick on any booking. Set to null to remove. */
    bonus: {
      name: 'Board games',
      hint: 'Free with any booking — we’ll set a table aside for your group.'
    }
  },

  /* ---------------------------------------------------------------------
     5. EXPERIENCES + GAME CATALOGUES
     ---------------------------------------------------------------------
     ###  ALL PRICES BELOW ARE PLACEHOLDERS  ###
     Replace `price` (naira, per person, per block of `unit` minutes) with
     your real rate card. Add/remove games freely — the site rebuilds itself
     from this list.
     --------------------------------------------------------------------- */
  experiences: [
    {
      id:'vr360',
      name:'360° VR Experience',
      tag:'Free-roam',
      icon:'vr',
      accent:'orange',
      blurb:'Step fully inside the game. Full-body tracking on our free-roam floor — walk, duck, aim and dodge in a world that surrounds you completely.',
      image:'assets/img/vr360.webp',
      price:3000,          // ### PLACEHOLDER ###
      unit:15,             // minutes per block
      unitLabel:'15 mins',
      durations:[15,30,45,60],
      games:[
        'Beat Saber',
        'Superhot VR',
        'Richie’s Plank Experience',
        'The Walking Dead: Saints & Sinners',
        'Arizona Sunshine 2',
        'Job Simulator',
        'Gorilla Tag',
        'Elven Assassin',
        'Creed: Rise to Glory',
        'Roller Coaster VR',
        'Space Pirate Trainer',
        'Deep Sea Dive VR'
      ]
    },
    {
      id:'racing',
      name:'Car Racing',
      tag:'Racing rig',
      icon:'car',
      accent:'cyan',
      blurb:'Bucket seat, wheel, pedals and a grid of rivals. Pick your car and your circuit, then chase the lap record.',
      /* ### TODO ### drop a photo at assets/img/racing.webp and put the path here.
         Empty for now, so the card shows the branded gradient. */
      image:'',
      price:2500,          // ### PLACEHOLDER ###
      unit:15,
      unitLabel:'15 mins',
      durations:[15,30,45,60],
      games:[              // ### PLACEHOLDER ### — swap for the titles you actually run
        'Gran Turismo 7',
        'F1 25',
        'Assetto Corsa Competizione',
        'Forza Motorsport',
        'Need for Speed Unbound',
        'EA Sports WRC',
        'Project CARS 2',
        'Dirt Rally 2.0'
      ]
    },
    {
      id:'ps5',
      name:'PlayStation 5',
      tag:'Console',
      icon:'pad',
      accent:'blue',
      blurb:'Sofa, big screen, cold drink, controller in hand. Solo runs, split-screen grudge matches and everything in between.',
      image:'assets/img/ps5.webp',
      price:2000,          // ### PLACEHOLDER ###
      unit:30,
      unitLabel:'30 mins',
      durations:[30,60,90,120],
      games:[
        'EA FC 26',
        'Mortal Kombat 1',
        'Tekken 8',
        'Call of Duty: Black Ops 6',
        'NBA 2K26',
        'Gran Turismo 7',
        'Spider-Man 2',
        'God of War Ragnarök',
        'Street Fighter 6',
        'WWE 2K25',
        'F1 25',
        'It Takes Two'
      ]
    },
    {
      id:'quest',
      name:'Meta Quest Headset',
      tag:'Standalone VR',
      icon:'headset',
      accent:'cyan',
      blurb:'Grab a Quest, pick a world and go. Seated or standing, easy to learn, impossible to put down.',
      /* ### TODO ### drop a photo at assets/img/quest.webp and put the path back
         here. Left empty for now, so the card falls back to the branded gradient. */
      image:'',
      price:2500,          // ### PLACEHOLDER ###
      unit:15,
      unitLabel:'15 mins',
      durations:[15,30,45,60],
      games:[
        'Beat Saber',
        'Asgard’s Wrath 2',
        'Resident Evil 4 VR',
        'Walkabout Mini Golf',
        'Blade & Sorcery: Nomad',
        'Pistol Whip',
        'Population: One',
        'Golf+',
        'Eleven Table Tennis',
        'Demeo',
        'The Climb 2',
        'I Expect You To Die 3'
      ]
    },
    {
      id:'karaoke',
      name:'Karaoke Room',
      tag:'Sing',
      icon:'mic',
      accent:'yellow',
      blurb:'Private room, real mics, a catalogue that runs from Afrobeats to power ballads. Bring the crew and embarrass yourselves properly.',
      image:'assets/img/karaoke.webp',
      price:5000,          // ### PLACEHOLDER ###  (room, not per head)
      unit:60,
      unitLabel:'1 hour',
      perRoom:true,        // priced per room rather than per player
      durations:[60,120,180],
      gamesLabel:'What are you singing?',
      gamesHint:'Pick the vibe for your session — our host cues up the playlist. You can always change your mind on the night.',
      games:[
        'Afrobeats — Burna Boy, Wizkid, Davido, Asake',
        'Nigerian Classics — Fela, Onyeka Owenu, 2Baba',
        'Amapiano & Afro House',
        'Gospel & Worship',
        'R&B and Soul',
        'Hip-Hop & Rap',
        'Pop Anthems',
        '90s & 2000s Throwbacks',
        'Rock & Power Ballads',
        'Highlife & Old School',
        'Reggae & Dancehall',
        'Surprise me — host’s pick'
      ]
    }
  ],

  /* ---------------------------------------------------------------------
     6. EVENTS
     --------------------------------------------------------------------- */
  events: {
    fifa: {
      id:'fifa',
      name:'Arena FIFA Tournament',
      cadence:'Every Friday',
      time:'6:00pm',
      weekday:5,                 // 0=Sun … 5=Fri
      hour:18,
      entry:2000,                // ### PLACEHOLDER ###
      format:'Single elimination · EA FC 26 · 6-minute halves',
      slots:32,                  // bracket size
      prize:'Cash pot + a month of free play for the winner',   // ### PLACEHOLDER ###
      bullets:[
        'Open bracket — walk in as a stranger, leave with a rivalry',
        'Controllers and settings identical across every station',
        'Doors 5:30pm, first whistle 6:00pm sharp',
        'Spectators free — the room is half the fun'
      ]
    },
    karaoke: {
      id:'karaoke-challenge',
      name:'Karaoke Challenge',
      cadence:'Last Saturday of every month',
      time:'7:00pm',
      weekday:6,                 // Saturday
      nth:'last',                // last <weekday> of the month
      hour:19,
      entry:2500,                // ### PLACEHOLDER ###
      format:'Two rounds · judged on crowd reaction',
      slots:24,
      prize:'Trophy, bragging rights and a prize from the bar',  // ### PLACEHOLDER ###
      bullets:[
        'Any language, any genre — the crowd decides',
        'Round one solo, round two duet or group',
        'Sign-up closes when the 24 slots fill',
        'Come to sing or come to heckle, both welcome'
      ]
    }
  }
};
