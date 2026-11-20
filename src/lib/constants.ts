import type { Category, Season } from '../types'

export const CATEGORIES: { id: Category; label: string; singular: string }[] = [
  { id: 'tops', label: 'Tops', singular: 'Top' },
  { id: 'bottoms', label: 'Bottoms', singular: 'Bottoms' },
  { id: 'dresses', label: 'Dresses', singular: 'Dress' },
  { id: 'outerwear', label: 'Outerwear', singular: 'Outerwear' },
  { id: 'shoes', label: 'Shoes', singular: 'Shoes' },
  { id: 'accessories', label: 'Accessories', singular: 'Accessory' },
  { id: 'other', label: 'Other', singular: 'Item' },
]

export const categoryInfo = (id: Category) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]

export const SEASONS: { id: Season; label: string }[] = [
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'winter', label: 'Winter' },
]

export const MULTICOLOR = 'Multicolor'

export const COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#222222' },
  { name: 'White', hex: '#f4f4f2' },
  { name: 'Grey', hex: '#9ca3af' },
  { name: 'Beige', hex: '#d8c3a5' },
  { name: 'Brown', hex: '#7c4a2d' },
  { name: 'Red', hex: '#c0392b' },
  { name: 'Pink', hex: '#ec8fb0' },
  { name: 'Orange', hex: '#e67e22' },
  { name: 'Yellow', hex: '#f1c40f' },
  { name: 'Green', hex: '#3f8f4f' },
  { name: 'Blue', hex: '#2f7fd1' },
  { name: 'Navy', hex: '#1f2f5c' },
  { name: 'Purple', hex: '#7d4bb3' },
  { name: MULTICOLOR, hex: '' },
]

export const paletteHex = (name: string) => COLORS.find((c) => c.name === name)?.hex ?? ''
