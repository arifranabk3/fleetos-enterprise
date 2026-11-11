import assert from 'assert';
import { formatCents, formatDate, getStatusBadgeClass } from '../lib/financialFormatters';

console.log('===============================================================');
console.log('       FLEETOS PHASE 10.2 FINANCIAL FRONTEND UNIT TESTS        ');
console.log('===============================================================');

// 1. Currency Formatting Tests
console.log('--- TEST GROUP 1: FINANCIAL CURRENCY FORMATTING ---');

const formatted1 = formatCents(15000, 'USD');
assert.strictEqual(formatted1, '$150.00', '15000 cents must format to $150.00');
console.log('✓ Test 1: formatCents formats standard amount (15000 -> $150.00)');

const formatted2 = formatCents(0, 'USD');
assert.strictEqual(formatted2, '$0.00', '0 cents must format to $0.00');
console.log('✓ Test 2: formatCents formats zero ($0.00)');

const formatted3 = formatCents(-4500, 'USD');
assert.strictEqual(formatted3, '-$45.00', '-4500 cents must format to -$45.00');
console.log('✓ Test 3: formatCents formats negative credit balance (-4500 -> -$45.00)');

const formatted4 = formatCents(123456789, 'USD');
assert.strictEqual(formatted4, '$1,234,567.89', 'Large cents format with proper commas');
console.log('✓ Test 4: formatCents formats large enterprise amounts with comma grouping');

// 2. Date Formatting Tests
console.log('--- TEST GROUP 2: DATE FORMATTING & RESILIENCE ---');

const dateStr = '2026-11-11T12:00:00Z';
const formattedDate = formatDate(dateStr);
assert.ok(formattedDate.includes('2026') || formattedDate.includes('Nov'), 'Formatted date must represent valid time');
console.log('✓ Test 5: formatDate formats ISO dates cleanly');

const emptyDate = formatDate(undefined);
assert.strictEqual(emptyDate, '—', 'Undefined date returns dash');
console.log('✓ Test 6: formatDate handles undefined safely without crashing');

// 3. Status Badge CSS Logic
console.log('--- TEST GROUP 3: FINANCIAL LIFECYCLE BADGE MAPPING ---');

const paidBadge = getStatusBadgeClass('PAID');
assert.ok(paidBadge.includes('emerald') || paidBadge.includes('green'), 'PAID status must be emerald green');
console.log('✓ Test 7: PAID status maps to emerald badge styling');

const voidBadge = getStatusBadgeClass('VOID');
assert.ok(voidBadge.includes('graphite') || voidBadge.includes('slate') || voidBadge.includes('gray'), 'VOID status maps to neutral archived styling');
console.log('✓ Test 8: VOID status maps to neutral graphite styling');

const draftBadge = getStatusBadgeClass('DRAFT');
assert.ok(draftBadge.includes('slate') || draftBadge.includes('gray'), 'DRAFT status maps to neutral slate styling');
console.log('✓ Test 9: DRAFT status maps to slate styling');

const overdueBadge = getStatusBadgeClass('OVERDUE');
assert.ok(overdueBadge.includes('red') || overdueBadge.includes('rose'), 'OVERDUE status maps to urgent alert badge');
console.log('✓ Test 10: OVERDUE status maps to alert styling');

console.log('===============================================================');
console.log('🎉 ALL 10 PHASE 10.2 FRONTEND UNIT TESTS PASSED (100%)');
console.log('===============================================================');

