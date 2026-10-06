"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { createOrderAction } from "@/app/pedido/actions";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { calculateQuote } from "@/lib/orders/pricing";
import { initialBuyer, initialDelivery, type BuyerDraft, type Campus, type CartSelection, type CatalogBook, type DeliveryDraft } from "@/lib/orders/types";
import { createBuyerSchema, createCartSchema, createDeliverySchema, createOrderDraftSchema, consentSchema } from "@/lib/orders/validation";
import { cn } from "@/lib/utils";
import { CatalogStep } from "./catalog-step";
import { BuyerStep } from "./buyer-step";
import { DeliveryStep } from "./delivery-step";
import { ConfirmationStep } from "./confirmation-step";
import { OrderConsent } from "./order-consent";
import { OrderSummary, AccountBreakdown } from "./summary";
import type { FieldErrors } from "./fields";

const steps = [
  { name: "Publicaciones", title: "Elige tus publicaciones", description: "Selecciona los títulos y las cantidades que necesitas." },
  { name: "Comprador", title: "Cuéntanos quién compra", description: "Tus datos nos permiten aplicar el precio correspondiente y contactarte." },
  { name: "Entrega", title: "¿Cómo quieres recibirlas?", description: "Elige envío a domicilio o recojo en la biblioteca de un campus." },
  { name: "Confirmación", title: "Revisa tu pedido", description: "Comprueba las publicaciones, tus datos y el detalle de pago por cuenta." },
] as const;

export function OrderWizard({ catalog, campuses, submissionEnabled = false }: { catalog: CatalogBook[]; campuses: Campus[]; submissionEnabled?: boolean }) {
  const [step, setStep] = useState(0);
  const [submitting, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const sending = useRef(false);
  const router = useRouter();
  const [cart, setCart] = useState<CartSelection[]>([]);
  const [buyer, setBuyer] = useState<BuyerDraft>(initialBuyer);
  const [delivery, setDelivery] = useState<DeliveryDraft>(initialDelivery);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const quote = calculateQuote(catalog, cart, buyer.type, delivery);

  function resetValidation() { setErrors({}); setErrorMessage(""); setConsentAccepted(false); }

  function goTo(next: number) {
    if (next < step) { setConsentAccepted(false); }
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
      const result = createOrderDraftSchema(catalog, campuses).safeParse({ cart, buyer, delivery });
      if (!result.success) {
        const firstPath = result.error.issues[0]?.path[0];
        const invalidStep = firstPath === "cart" ? 0 : firstPath === "buyer" ? 1 : 2;
        setStep(invalidStep);
        showErrors(result.error.issues.filter((issue) => issue.path[0] === firstPath).map((issue) => ({ ...issue, path: issue.path.slice(1) })));
        return;
      }
      const accepted = consentSchema.safeParse({ accepted: consentAccepted });
      if (!accepted.success) return showErrors(accepted.error.issues);
      if (!submissionEnabled || sending.current) return;
      requestId.current ??= crypto.randomUUID();
      sending.current = true;
      const payload = { requestId: requestId.current, cart, buyer, delivery, consent: { accepted: consentAccepted } };
      startTransition(async () => {
        try {
          const created = await createOrderAction(payload);
          if (!created.success) { showErrors([{ path: ["form"], message: created.message }]); return; }
          router.push(`/seguimiento/${created.trackingToken}`);
        } catch { showErrors([{ path: ["form"], message: "No pudimos confirmar la respuesta. Reintenta sin cambiar tus datos para evitar duplicados." }]); }
        finally { sending.current = false; }
      });
    }
  }

  return (
    <div>
      <nav aria-label="Pasos del pedido" className="mb-8 border-b border-border">
        <ol className="grid grid-cols-4">
          {steps.map((item, index) => <li key={item.name}>
            <button type="button" disabled={index > step || submitting} onClick={() => goTo(index)} aria-current={index === step ? "step" : undefined} className={cn("-mb-px flex min-h-16 w-full flex-col items-center justify-center gap-1.5 border-b-2 px-1 pb-3 text-[10px] font-medium sm:flex-row sm:gap-2 sm:text-xs", index === step ? "border-primary text-primary" : "border-transparent text-muted-foreground", index > step && "opacity-50")}>
              <span className={cn("flex size-6 items-center justify-center rounded-full text-[10px] tabular-nums", index === step ? "bg-primary text-white" : index < step ? "bg-secondary text-primary" : "bg-muted")}>{index < step ? <Check className="size-3" aria-hidden="true" /> : index + 1}</span>{item.name}
            </button>
          </li>)}
        </ol>
      </nav>
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <form id="order-wizard-form" noValidate onSubmit={submit} className="min-w-0" aria-busy={submitting}>
          <fieldset disabled={submitting} className="min-w-0">
          <div className="mb-7">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Paso {step + 1} de 4</p>
            <h2 ref={headingRef} tabIndex={-1} className="page-heading scroll-mt-6 outline-none">{steps[step].title}</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{steps[step].description}</p>
          </div>
          {errorMessage ? <div ref={errorRef} tabIndex={-1} role="alert" className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive outline-none focus-visible:ring-2 focus-visible:ring-destructive">{errorMessage}</div> : null}
          <div key={step} className="enter-page">
            {step === 0 ? <CatalogStep catalog={catalog} cart={cart} customerType={buyer.type} onQuantity={quantityChange} /> : null}
            {step === 1 ? <BuyerStep buyer={buyer} campuses={campuses} errors={errors} onChange={(value) => { setBuyer(value); resetValidation(); }} /> : null}
            {step === 2 ? <DeliveryStep delivery={delivery} campuses={campuses} errors={errors} buyer={buyer} onChange={(value) => { setDelivery(value); resetValidation(); }} /> : null}
            {step === 3 ? <ConfirmationStep buyer={buyer} delivery={delivery} campuses={campuses} quote={quote} onEdit={(value) => { setConsentAccepted(false); goTo(value); }} /> : null}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            {step > 0 ? <Button type="button" variant="ghost" className="h-11 gap-2 px-3" onClick={() => goTo(step - 1)}><ArrowLeft aria-hidden="true" />Volver</Button> : <span />}
            {step < 3 ? <Button type="submit" className="h-11 gap-2 px-5" disabled={step === 0 && catalog.length === 0}>Continuar<ArrowRight aria-hidden="true" /></Button> : null}
          </div>
          </fieldset>
        </form>
        <aside className="space-y-5 lg:sticky lg:top-6" aria-label="Resumen y envío del pedido">
        <OrderSummary quote={quote} editable={step === 0 && !submitting} onRemove={(bookId) => { setCart((current) => current.filter((item) => item.bookId !== bookId)); resetValidation(); }} />
          {step === 3 ? <OrderConsent accepted={consentAccepted} onAccepted={(value) => { setConsentAccepted(value); setErrorMessage(""); }} disabled={!consentAccepted || submitting || !submissionEnabled} pending={submitting} enabled={submissionEnabled} /> : null}
          <AccountBreakdown quote={quote} />
        </aside>
      </div>
    </div>
  );
}
