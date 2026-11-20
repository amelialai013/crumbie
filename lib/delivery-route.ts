import { VIC_POSTCODES } from "@/lib/vic-postcodes";

type Point = [number, number];

// Ivanhoe, VIC 3079
const DEPOT: Point = [-37.769, 145.045];

const coordinates = new Map<string, Point>(VIC_POSTCODES.map(([code, lat, lng]) => [String(code), [lat, lng]]));

const distanceKm = ([lat1, lng1]: Point, [lat2, lng2]: Point) => {
	const rad = Math.PI / 180;
	const dLat = (lat2 - lat1) * rad;
	const dLng = (lng2 - lng1) * rad;
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
	return 12742 * Math.asin(Math.sqrt(a));
};

// Orders stops as a round trip from Ivanhoe: nearest-neighbour, tightened with 2-opt,
// then oriented so the nearest stop comes first. Stops with an unknown postcode go last.
export function routeFromIvanhoe<T>(stops: T[], postcodeOf: (stop: T) => string | undefined): T[] {
	const located = stops.flatMap((stop) => {
		const point = coordinates.get((postcodeOf(stop) || "").trim());
		return point ? [{ stop, point }] : [];
	});
	const unknown = stops.filter((stop) => !coordinates.has((postcodeOf(stop) || "").trim()));

	const remaining = [...located];
	let tour: typeof located = [];
	let current = DEPOT;
	while (remaining.length) {
		let best = 0;
		for (let i = 1; i < remaining.length; i++) {
			if (distanceKm(current, remaining[i].point) < distanceKm(current, remaining[best].point)) best = i;
		}
		const [next] = remaining.splice(best, 1);
		tour.push(next);
		current = next.point;
	}

	const points = (list: typeof located): Point[] => [DEPOT, ...list.map((item) => item.point), DEPOT];
	const length = (list: typeof located) => points(list).reduce((sum, point, i, all) => (i ? sum + distanceKm(all[i - 1], point) : 0), 0);
	let improved = true;
	while (improved) {
		improved = false;
		for (let i = 0; i < tour.length - 1; i++) {
			for (let j = i + 1; j < tour.length; j++) {
				const candidate = [...tour.slice(0, i), ...tour.slice(i, j + 1).reverse(), ...tour.slice(j + 1)];
				if (length(candidate) < length(tour) - 1e-9) {
					tour = candidate;
					improved = true;
				}
			}
		}
	}

	if (tour.length > 1 && distanceKm(DEPOT, tour[tour.length - 1].point) < distanceKm(DEPOT, tour[0].point)) tour.reverse();
	return [...tour.map((item) => item.stop), ...unknown];
}
