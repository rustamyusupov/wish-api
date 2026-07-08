export type PriceChange = {
	direction: 'up' | 'down';
	percent: number;
	low: boolean;
};

export const currencyTail = <T extends { code: string }>(history: T[]): T[] => {
	if (history.length === 0) return [];

	let start = history.length - 1;
	while (start > 0 && history[start - 1].code === history[start].code) start -= 1;

	return history.slice(start);
};

const weightedMedian = (values: { amount: number; weight: number }[]) => {
	const sorted = [...values].sort((a, b) => a.amount - b.amount);
	const total = sorted.reduce((sum, value) => sum + value.weight, 0);

	let accumulated = 0;
	for (const value of sorted) {
		accumulated += value.weight;
		if (accumulated >= total / 2) return value.amount;
	}

	return sorted[sorted.length - 1].amount;
};

export const priceChange = (
	history: { amount: number; code: string; createdAt: Date }[],
	now: Date
): PriceChange | null => {
	const tail = currencyTail(history);
	if (tail.length < 2) return null;

	const current = tail[tail.length - 1];
	const low = current.amount <= Math.min(...tail.slice(0, -1).map((point) => point.amount));

	// each price weighs as long as it was in effect, so a brief spike cannot skew the median
	const weighted = tail.map((point, index) => ({
		amount: point.amount,
		weight: Math.max(
			(index === tail.length - 1 ? now.getTime() : tail[index + 1].createdAt.getTime()) -
				point.createdAt.getTime(),
			0
		)
	}));
	const median = weightedMedian(weighted);

	if (median === 0) return null;
	if (current.amount === median && !low) return null;

	return {
		direction: current.amount > median ? 'up' : 'down',
		percent: (Math.abs(current.amount - median) / median) * 100,
		low
	};
};
