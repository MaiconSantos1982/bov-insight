import {
  CloudRainIcon,
  DropletsIcon,
  ThermometerIcon,
  WindIcon,
} from "lucide-react";

import {
  DEFAULT_LOCATION,
  useLocation,
} from "@/hooks/use-location";
import { useWeather } from "@/hooks/use-weather";
import { getWeatherIcon } from "@/lib/weather-utils";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Widget, WidgetContent } from "@/components/ui/widget";

export default function WidgetDemo() {
  const { coordinates, city, isLoading: isLoadingLocation } = useLocation();
  const { data: weather, isLoading: isLoadingWeather } = useWeather(
    coordinates?.lat ?? DEFAULT_LOCATION.lat,
    coordinates?.lon ?? DEFAULT_LOCATION.lon,
  );

  const isLoading = isLoadingLocation || isLoadingWeather;

  if (isLoading) {
    return (
      <Widget size="md">
        <WidgetContent>
          <div className="flex w-full items-center justify-center">
            <Label className="animate-pulse">Carregando clima...</Label>
          </div>
        </WidgetContent>
      </Widget>
    );
  }

  return (
    <Widget size="md">
      <WidgetContent>
        <div className="flex w-full flex-col items-center justify-center gap-3">
          {weather && getWeatherIcon(weather.weatherCode)}
          <div className="flex flex-col items-center justify-center gap-2">
            <Label className="text-3xl">{weather?.temperature}&deg;C</Label>
            <Label>{city || "Local Desconhecido"}</Label>
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center gap-5">
          <div className="flex w-full items-center justify-center gap-16">
            <InfoItem
              icon={WindIcon}
              label="Vento"
              value={`${weather?.windSpeed} km/h`}
            />
            <InfoItem
              icon={ThermometerIcon}
              label="Sensação de"
              value={`${weather?.feelsLike}\u00b0`}
            />
          </div>
          <div className="flex w-full items-center justify-center gap-16">
            <InfoItem
              icon={CloudRainIcon}
              label="Precipitação"
              value={`${weather?.chanceOfRain} mm`}
            />
            <InfoItem
              icon={DropletsIcon}
              label="Umidade"
              value={`${weather?.humidity}%`}
            />
          </div>
        </div>
      </WidgetContent>
    </Widget>
  );
}

type InfoItemProps = {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string;
};

const InfoItem = (el: InfoItemProps) => {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className="space-y-2">
          <el.icon className="stroke-muted-foreground size-6" />
          <Label className="text-base font-normal">{el.value}</Label>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <Label className="text-sm font-normal">{el.label}</Label>
      </TooltipContent>
    </Tooltip>
  );
};
