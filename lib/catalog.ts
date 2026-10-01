export type PickupDate = { id: string; date: string; window: string; soldOut?: boolean };
export type Product = { id:string; slug:string; name:string; description:string; ingredients:string; allergens:string; images:string[]; imageMode?: "gallery"; variants:{id:string;label:string;quantity:number;price:number}[]; soldOut?:boolean; soldOutDates?:string[] };
export function productSlugFromName(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export const defaultProductIngredients = "Pickup dates close 72 hours before their scheduled start time, orders can be placed up until this time. Pickup is in Ivanhoe, Victoria. Exact address provided in your confirmation email after purchase.";
export const defaultProductAllergens = "Contains gluten, dairy, eggs and soy. Made in a kitchen that handles peanuts and tree nuts; cross-contact is possible.";
export const pickupDates: PickupDate[] = [
  { id:"pickup-1", date:"2026-09-12", window:"10:00am–12:00pm" },
  { id:"pickup-2", date:"2026-09-19", window:"10:00am–12:00pm" },
  { id:"pickup-3", date:"2026-09-26", window:"10:00am–12:00pm" },
  { id:"pickup-2027-01-01", date:"2027-01-01", window:"10:00am–12:00pm" },
];
export const products: Product[] = [
  { id:"product-signature", slug:productSlugFromName("Signature Crumbie"), name:"Signature Crumbie", description:"A thick chocolate chip cookie with crisp, golden edges and a soft, tender centre, packed with generous chunks of rich chocolate in every bite.", ingredients:defaultProductIngredients, allergens:defaultProductAllergens, images:["https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1400&q=88","https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1400&q=88"], variants:[{id:"signature-6",label:"Box of 6",quantity:6,price:30},{id:"signature-12",label:"Box of 12",quantity:12,price:55}] },
  { id:"product-seasonal", slug:productSlugFromName("Biscoff Caramel"), name:"Biscoff Caramel", description:"A golden cookie with buttery caramel and creamy white chocolate, finished with a generous Biscoff crumb for a rich caramelised crunch.", ingredients:defaultProductIngredients, allergens:defaultProductAllergens, images:["https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=1400&q=88","https://images.unsplash.com/photo-1598373182133-52452f7691ef?auto=format&fit=crop&w=1400&q=88"], variants:[{id:"seasonal-6",label:"Box of 6",quantity:6,price:32},{id:"seasonal-12",label:"Box of 12",quantity:12,price:59}] },
];
export const sharedKitchenWarning="Club Crumbie handles gluten, dairy, eggs, soy, peanuts and tree nuts. Cross-contact is possible, and we cannot accommodate allergy requests for standard boxes.";
export function isDateClosed(date: PickupDate) {
  const cutoff = new Date(`${date.date}T10:00:00+10:00`).getTime() - 72 * 60 * 60 * 1000;
  return date.soldOut === true || Date.now() >= cutoff;
}

// Product image contract: cover is always side-on; rotation opens bird's-eye.
export const PRODUCT_SIDE_PROFILE_INDEX = 0;
export const PRODUCT_BIRDS_EYE_INDEX = 1;
export const PRODUCT_IMAGE_COUNT = 9; // one cover plus eight rotation angles
export const GENERATED_IMAGE_COUNTS = [1, 2, 3, 4, 5, 9] as const;
export const RECOMMENDED_IMAGE_COUNT = 9;
// rotationViews indexes per image count: cover first, then evenly spaced
// orbit angles so the product-page rotation stays coherent.
export const ROTATION_FRAME_PLANS: Record<number, readonly number[]> = {
  1: [0],
  2: [0, 1],
  3: [0, 1, 5],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 5, 7],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};
export function productSideProfile(product: Product) {
  return product.imageMode === "gallery" ? product.images[PRODUCT_SIDE_PROFILE_INDEX] : undefined;
}
export function productRotationImages(product: Product) {
  return product.images.length > 1 ? product.images.slice(PRODUCT_BIRDS_EYE_INDEX) : product.images;
}
