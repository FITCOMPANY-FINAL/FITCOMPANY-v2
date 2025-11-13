import { Component } from '@angular/core';
import {importProvidersFrom} from "@angular/core";
import {
  LucideAngularModule, 
  LayoutDashboard, 
  ShoppingCart,
      ShoppingBasket,
      BookText,
      ChartBarStacked,
      UserCog,
      IdCard,
      Ruler,
      ShieldCheck,
      Fingerprint,
      User,
      Box 

} from "lucide-angular";


export function lucideProviders () {
  return importProvidersFrom(
    LucideAngularModule.pick({
      LayoutDashboard,
      ShoppingCart,
      ShoppingBasket,
      BookText,
      ChartBarStacked,
      UserCog,
      IdCard,
      Ruler,
      ShieldCheck,
      Fingerprint,
      User,
      Box 
    })
  );
}
