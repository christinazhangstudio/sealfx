import { ChartType } from "chart.js";

declare module "chart.js" {
  interface ChartDataset<TType extends ChartType = ChartType> {
    crosshairX?: number | null;
  }
}