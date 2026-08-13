export type AuctionExpenseCategory =
  | 'locacao'
  | 'equipe'
  | 'marketing'
  | 'leiloeiro'
  | 'transporte'
  | 'outros';

export const AUCTION_EXPENSE_CATEGORIES: { id: AuctionExpenseCategory; label: string }[] = [
  { id: 'locacao', label: 'Locação / estrutura' },
  { id: 'equipe', label: 'Equipe' },
  { id: 'marketing', label: 'Marketing / divulgação' },
  { id: 'leiloeiro', label: 'Leiloeiro' },
  { id: 'transporte', label: 'Transporte / logística' },
  { id: 'outros', label: 'Outros' },
];

export function auctionExpenseCategoryLabel(id: AuctionExpenseCategory | string): string {
  return AUCTION_EXPENSE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
