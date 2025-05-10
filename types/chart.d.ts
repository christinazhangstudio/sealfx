import { ChartType, ChartDataset } from "chart.js";

declare module "chart.js" {
  interface ChartDataset<TType extends ChartType = ChartType, TData = unknown> {
    crosshairX?: number | null;
  }
}