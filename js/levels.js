// Top-down maps: # is a wall, . is a passage, S is the start, and F is the finish.
// Rows run along Z (from the far side to the near side); columns run along X.
// Corridor width is 1.25 and ball diameter is 0.56, leaving 0.69 units of clearance.
// The opening in the bottom wall lets the ball reach the island edge and fall.
var cellSize = 1.25;
var levels = [
  {
    map: [
      '#########',
      '#......F#',
      '#..###..#',
      '#.......#',
      '#..###..#',
      '#.......#',
      '#.......#',
      '#S......#',
      '#.#######'
    ]
  },
  {
    map: [
      '#########',
      '#.....#F#',
      '#.###.#.#',
      '#.#...#.#',
      '#.#.###.#',
      '#.#.....#',
      '#.#####.#',
      '#S....#.#',
      '#.#######'
    ]
  },
  {
    map: [
      '#########',
      '#.......#',
      '#.#####.#',
      '#.#F#...#',
      '#.#.#.###',
      '#.#.#...#',
      '#.#.###.#',
      '#S#.....#',
      '#.#######'
    ]
  },
  {
    map: [
      '#########',
      '#...#..F#',
      '#.#.#.#.#',
      '#.#.#.#.#',
      '#.#.#.###',
      '#.#.#...#',
      '#.#.###.#',
      '#S#.....#',
      '#.#######'
    ]
  },
  {
    map: [
      '#########',
      '#...#F..#',
      '#.#.###.#',
      '#.#.....#',
      '#.#######',
      '#.......#',
      '#######.#',
      '#S......#',
      '#.#######'
    ]
  }
];
