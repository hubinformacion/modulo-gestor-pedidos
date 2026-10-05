"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { PreviewCompletion } from "./preview-completion";
import { calculateQuote } from "@/lib/orders/pricing";
import { initialBuyer, initialDelivery, type BuyerDraft, type Campus, type CartSelection, type CatalogBook, type DeliveryDraft } from "@/lib/orders/types";
import { createBuyerSchema, createCartSchema, createDeliverySchema, createOrderDraftSchema, consentSchema } from "@/lib/orders/validation";
import { cn } from "@/lib/utils";
import { CatalogStep } from "./catalog-step";
import { BuyerStep } from "./buyer-step";
import { DeliveryStep } from "./delivery-step";
import { ConfirmationStep } from "./confirmation-step";
import { OrderSummary } from "./summary";
import type { FieldErrors } from "./fields";

const steps = [
  { name: "Publicaciones", title: "Elige tus publicaciones", description: "Selecciona los títulos y las cantidades que necesitas." },
  { name: "Comprador", title: "Cuéntanos quién compra", description: "Tus datos nos permiten aplicar el precio correspondiente y contactarte." },
  { name: "Entrega", title: "¿Cómo quieres recibirlas?", description: "Elige envío a domicilio o recojo en la biblioteca de un campus." },
  { name: "Confirmación", title: "Revisa tu pedido", description: "Comprueba las publicaciones, tus datos y el detalle de pago por cuenta." },
] as const;

export function OrderWizard({ catalog, campuses, preview = false }: { catalog: CatalogBook[]; campuses: Campus[]; preview?: boolean }) {
  const [step, setStep] = useState(0);
  const [cart, setCart] = useState<CartSelection[]>([]);
  const [buyer, setBuyer] = useState<BuyerDraft>(initialBuyer);
  const [delivery, setDelivery] = useState<DeliveryDraft>(initialDelivery);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [consent, setConsent] = useState({ privacyAccepted: false, treatmentAuthorized: false });
  const reviewed = consent.privacyAccepted && consent.treatmentAuthorized;
  const [previewComplete, setPreviewComplete] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const quote = calculateQuote(catalog, cart, buyer.type, delivery);

  function resetValidation() { setErrors({}); setErrorMessage(""); setConsent({ privacyAccepted: false, treatmentAuthorized: false }); setPreviewComplete(false); }

  function goTo(next: number) {
    if (next < step) { setConsent({ privacyAccepted: false, treatmentAuthorized: false }); setPreviewComplete(false); }
    setStep(next); setErrors({}); setErrorMessage("");
    requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true });
      headingRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
    });
  }

  function showErrors(issues: { path: PropertyKey[]; message: string }[]) {
    const fieldErrors: FieldErrors = {};
    for (const issue of issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    setErrors(fieldErrors);
    setErrorMessage(issues[0]?.message ?? "Revisa los datos para continuar.");
    sileo.error({ title: "Revisa este paso", description: issues[0]?.message });
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  function quantityChange(book: CatalogBook, quantity: number) {
    const next = Math.max(0, Math.min(book.stock, Math.trunc(quantity)));
    setCart((current) => next === 0 ? current.filter((item) => item.bookId !== book.id)
      : current.some((item) => item.bookId === book.id) ? current.map((item) => item.bookId === book.id ? { ...item, quantity: next } : item)
      : [...current, { bookId: book.id, quantity: next }]);
    resetValidation();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 0) {
      const result = createCartSchema(catalog).safeParse(cart);
      if (!result.success) return showErrors(result.error.issues);
      setCart(result.data); goTo(1);
    } else if (step === 1) {
      const result = createBuyerSchema(campuses).safeParse(buyer);
      if (!result.success) return showErrors(result.error.issues);
      setBuyer(result.data);
      goTo(2);
    } else if (step === 2) {
      const result = createDeliverySchema(campuses).safeParse(delivery);
      if (!result.success) return showErrors(result.error.issues);
      setDelivery(result.data); goTo(3);
    } else {
      if (!preview) return;
      const result = createOrderDraftSchema(catalog, campuses).safeParse({ cart, buyer, delivery });
      if (!result.success) {
        const firstPath = result.error.issues[0]?.path[0];
        const invalidStep = firstPath === "cart" ? 0 : firstPath === "buyer" ? 1 : 2;
        setStep(invalidStep);
        showErrors(result.error.issues.filter((issue) => issue.path[0] === firstPath).map((issue) => ({ ...issue, path: issue.path.slice(1) })));
        return;
      }
      const accepted = consentSchema.safeParse(consent);
      if (!accepted.success) return showErrors(accepted.error.issues);
      // Phase 3 preview: intentionally no order creation, stock changes or email.
      setPreviewComplete(true);
      sileo.success({ title: "Revisión completada", description: "Este recorrido no crea un pedido ni realiza un cobro." });
    }
  }

  return (
    <div>
      {preview ? <p className="mb-6 rounded-lg border border-primary/20 bg-secondary/40 px-4 py-3 text-xs leading-6 text-primary"><strong className="font-semibold">Vista previa interna.</strong> Libros DEMO con precios y stock ficticios. Direcciones de campus proporcionadas por el administrador. No se generan pedidos.</p> : null}
      <nav aria-label="Pasos del pedido" className="mb-8 border-b border-border">
        <ol className="grid grid-cols-4">
          {steps.map((item, index) => <li key={item.name}>
            <button type="button" disabled={index > step} onClick={() => goTo(index)} aria-current={index === step ? "step" : undefined} className={cn("-mb-px flex min-h-16 w-full flex-col items-center justify-center gap-1.5 border-b-2 px-1 pb-3 text-[10px] font-medium sm:flex-row sm:gap-2 sm:text-xs", index === step ? "border-primary text-primary" : "border-transparent text-muted-foreground", index > step && "opacity-50")}>
              <span className={cn("flex size-6 items-center justify-center rounded-full text-[10px] tabular-nums", index === step ? "bg-primary text-white" : index < step ? "bg-secondary text-primary" : "bg-muted")}>{index < step ? <Check className="size-3" aria-hidden="true" /> : index + 1}</span>{item.name}
            </button>
          </li>)}
        </ol>
      </nav>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <form noValidate onSubmit={submit} className="min-w-0">
          <div className="mb-7">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Paso {step + 1} de 4</p>
            <h1 ref={headingRef} tabIndex={-1} className="page-heading scroll-mt-6 outline-none">{steps[step].title}</h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{steps[step].description}</p>
          </div>
          {errorMessage ? <div ref={errorRef} tabIndex={-1} role="alert" className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive">{errorMessage}</div> : null}
          <div key={step} className="enter-page">
            {step === 0 ? <CatalogStep catalog={catalog} cart={cart} customerType={buyer.type} onQuantity={quantityChange} /> : null}
            {step === 1 ? <BuyerStep buyer={buyer} campuses={campuses} errors={errors} onChange={(value) => { setBuyer(value); resetValidation(); }} /> : null}
            {step === 2 ? <DeliveryStep delivery={delivery} campuses={campuses} errors={errors} buyer={buyer} onChange={(value) => { setDelivery(value); resetValidation(); }} /> : null}
            {step === 3 ? <ConfirmationStep buyer={buyer} delivery={delivery} campuses={campuses} quote={quote} onEdit={(value) => { setConsent({ privacyAccepted: false, treatmentAuthorized: false }); setPreviewComplete(false); goTo(value); }} privacyAccepted={consent.privacyAccepted} treatmentAuthorized={consent.treatmentAuthorized} onConsent={(key, value) => { setConsent((current) => ({ ...current, [key]: value })); setErrorMessage(""); setPreviewComplete(false); }} /> : null}
          </div>
          {previewComplete ? <PreviewCompletion quote={quote} buyer={buyer} delivery={delivery} campuses={campuses} /> : null}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            {step > 0 ? <Button type="button" variant="ghost" className="h-11 gap-2 px-3" onClick={() => goTo(step - 1)}><ArrowLeft aria-hidden="true" />Volver</Button> : <span />}
            <Button type="submit" className="h-11 gap-2 px-5" disabled={step === 0 ? catalog.length === 0 : step === 3 ? !reviewed || previewComplete || !preview : false}>{step === 3 ? "Enviar pedido" : "Continuar"}{step < 3 ? <ArrowRight aria-hidden="true" /> : <Check aria-hidden="true" />}</Button>
          </div>
          {step === 3 && !preview ? <p className="mt-4 text-xs leading-5 text-muted-foreground">El registro de pedidos aún no está habilitado. Conserva esta página para revisar tus datos; todavía no se ha reservado stock.</p> : null}
        </form>
        <OrderSummary quote={quote} editable={step === 0} onRemove={(bookId) => { setCart((current) => current.filter((item) => item.bookId !== bookId)); resetValidation(); }} />
      </div>
    </div>
  );
}
