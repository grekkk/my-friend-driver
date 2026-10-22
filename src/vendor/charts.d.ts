declare const Charts: {
  bars: (el: HTMLElement, options: { labels: string[]; values: number[]; highlight: number; format: (value: number) => string; height: number; xAt?: number[] }) => void
  destroy: (el: HTMLElement) => void
}
export default Charts
