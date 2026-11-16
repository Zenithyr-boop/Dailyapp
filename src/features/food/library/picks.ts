/**
 * The coach's picks — editable: everyday staples that rank first among equal matches,
 * so "rice" finds cooked white rice before rice cakes. Ids from foodList.ts or
 * dishList.ts (checked in library.test.ts). Kept in its own file so the app never
 * loads the whole list just for these.
 */
export const FOOD_PICKS: ReadonlySet<number> = new Set([
  168878, // White rice, cooked
  169704, // Brown rice, cooked
  168877, // White rice, dry
  173904, // Oats, rolled, dry
  173905, // Oatmeal, cooked with water
  2708380, // Oatmeal, cooked
  173944, // Banana
  171688, // Apple
  171287, // Egg, whole, raw
  173424, // Egg, hard-boiled
  173423, // Egg, fried
  2707205, // Egg omelet or scrambled egg
  171477, // Chicken breast, cooked
  171077, // Chicken breast, raw
  169737, // Pasta, cooked
  169736, // Pasta, dry
  175180, // Shrimp, cooked
  175179, // Shrimp, raw
  170693, // Hamburger
  2706888, // Cheeseburger
  170093, // Potato, baked
  168483, // Sweet potato, baked
  2707542, // Peanut butter
  171413, // Olive oil
  171705, // Avocado
  169967, // Broccoli, cooked
  2706537, // Chicken and rice
  2708838, // Spaghetti with meat sauce
  2706375, // Chili with meat and beans
  175168, // Salmon, farmed, cooked
  174030, // Ground beef 90% lean, raw
  170894, // Greek yogurt, plain, nonfat
  2708612, // Cheese pizza, thin crust
  173709, // Tuna, canned in water
  174924, // White bread
  172688, // Whole-wheat bread
  171267, // Milk, 2%
  167762, // Strawberries
  171711, // Blueberries
  169097, // Orange
  170567, // Almonds
  173410, // Butter
  173414, // Cheddar
])
