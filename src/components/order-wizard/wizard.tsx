"use client";
import { scrollWizardTo } from "@/lib/ui/wizard-scroll";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { createOrderAction, reviewPricingAction } from "@/app/pedido/actions";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { calculateQuote, quoteStamp } from "@/lib/orders/pricing";
import { initialBuyer, initialDelivery, type BuyerDraft, type CouponOffer, type Campus, type CartSelection, type CatalogBook, type DeliveryDraft } from "@/lib/orders/types";
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

export function OrderWizard({ catalog, campuses, initialPricingAt, submissionEnabled = false }: { initialPricingAt: number; catalog: CatalogBook[]; campuses: Campus[]; submissionEnabled?: boolean }) {
  const [pricedCatalog, setPricedCatalog] = useState<CatalogBook[] | null>(null);
  const currentCatalog = pricedCatalog ?? catalog;
  const [pricingAt, setPricingAt] = useState(initialPricingAt);
  const [couponInput, setCouponInput] = useState("");
  const [couponOffer, setCouponOffer] = useState<CouponOffer | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
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
  const wizardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const quote = calculateQuote(currentCatalog, cart, buyer.type, delivery, pricingAt, couponOffer);

  function resetValidation() { setErrors({}); setErrorMessage(""); setConsentAccepted(false); setCouponOffer(null); setCouponMessage(""); }

  function goTo(next: number) {
    if (next < step) { setConsentAccepted(false); setCouponOffer(null); setCouponMessage(couponOffer ? "Vuelve a aplicar el cupón al confirmar el pedido." : ""); }
    setStep(next); setErrors({}); setErrorMessage("");
    scrollWizardTo(wizardRef.current, headingRef.current);
  }

  function applyCoupon() {
    setCouponMessage("");
    startTransition(async () => {
      const result = await reviewPricingAction({ cart, buyer, delivery, couponCode: couponInput }).catch(() => ({ success: false as const, message: "No pudimos comprobar el cupón. Reintenta." }));
      if (!result.success) { setCouponMessage(result.message); return; }
      setPricedCatalog([...result.catalog, ...currentCatalog.filter((book) => !result.catalog.some((current) => current.id === book.id)).map((book) => ({ ...book, stock: 0 }))]); setPricingAt(result.at); setCouponOffer(result.coupon); setConsentAccepted(false);
      if (!result.coupon) { setCouponMessage("Ingresa un código para aplicar un cupón."); return; }
      const priced = calculateQuote(result.catalog, cart, buyer.type, delivery, result.at, result.coupon);
      setCouponInput(result.coupon.code);
      setCouponMessage(priced.couponApplied ? `Cupón ${result.coupon.code} aplicado.` : "El precio actual ofrece igual o mayor ahorro. El cupón no se utilizará.");
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
      const result = createCartSchema(currentCatalog).safeParse(cart);
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
      setDelivery(result.data);
      startTransition(async () => {
        const prices = await reviewPricingAction({ cart, buyer, delivery: result.data }).catch(() => ({ success: false as const, message: "No pudimos actualizar los precios. Reintenta." }));
        if (!prices.success) { showErrors([{ path: ["form"], message: prices.message }]); return; }
        setPricedCatalog([...prices.catalog, ...currentCatalog.filter((book) => !prices.catalog.some((current) => current.id === book.id)).map((book) => ({ ...book, stock: 0 }))]);
        setPricingAt(prices.at); setConsentAccepted(false); goTo(3);
      });
    } else {
      const result = createOrderDraftSchema(currentCatalog, campuses).safeParse({ cart, buyer, delivery });
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
      const payload = { requestId: requestId.current, couponCode: quote.couponApplied?.code ?? "", expectedQuote: quoteStamp(quote), cart, buyer, delivery, consent: { accepted: consentAccepted } };
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
    <div ref={wizardRef} className="scroll-mt-6">
      {step === 3 ? <div className="mb-4 flex justify-end"><Button variant="ghost" className="text-xs text-primary" disabled={submitting} onClick={() => startTransition(async () => {
        const prices = await reviewPricingAction({ cart, buyer, delivery, couponCode: couponOffer?.code ?? "" }).catch(() => ({ success: false as const, message: "No pudimos actualizar los precios. Reintenta." }));
        if (!prices.success) { showErrors([{ path: ["form"], message: prices.message }]); return; }
        setPricedCatalog([...prices.catalog, ...currentCatalog.filter((book) => !prices.catalog.some((current) => current.id === book.id)).map((book) => ({ ...book, stock: 0 }))]); setPricingAt(prices.at); setCouponOffer(prices.coupon); setConsentAccepted(false);
      })}>Actualizar precios</Button></div> : null}
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
            {step === 0 ? <CatalogStep at={pricingAt} catalog={currentCatalog} cart={cart} customerType={buyer.type} onQuantity={quantityChange} /> : null}
            {step === 1 ? <BuyerStep buyer={buyer} campuses={campuses} errors={errors} onChange={(value) => { setBuyer(value); resetValidation(); }} /> : null}
            {step === 2 ? <DeliveryStep onBuyerChange={(value) => { setBuyer(value); resetValidation(); }} delivery={delivery} campuses={campuses} errors={errors} buyer={buyer} onChange={(value) => { setDelivery(value); resetValidation(); }} /> : null}
            {step === 3 ? <ConfirmationStep buyer={buyer} delivery={delivery} campuses={campuses} quote={quote} onEdit={(value) => { setConsentAccepted(false); goTo(value); }} /> : null}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
            {step > 0 ? <Button type="button" variant="ghost" className="h-11 gap-2 px-3" onClick={() => goTo(step - 1)}><ArrowLeft aria-hidden="true" />Volver</Button> : <span />}
            {step < 3 ? <Button type="submit" className="h-11 gap-2 px-5" disabled={step === 0 && currentCatalog.length === 0}>Continuar<ArrowRight aria-hidden="true" /></Button> : null}
          </div>
          </fieldset>
        </form>
        <aside className="space-y-5 lg:sticky lg:top-6" aria-label="Resumen y envío del pedido">
        {step === 3 ? <section className="rounded-xl border border-border bg-white p-5"><label htmlFor="order-coupon" className="mb-3 block text-sm font-semibold">¿Tienes un cupón?</label><div className="flex gap-2"><input id="order-coupon" value={couponInput} onChange={(event) => { setCouponInput(event.target.value.toUpperCase()); setCouponOffer(null); setCouponMessage(""); setConsentAccepted(false); }} maxLength={32} placeholder="Ingresa tu código" disabled={submitting} className="h-10 min-w-0 flex-1 rounded-lg border border-input px-3 text-xs" /><Button type="button" variant="outline" className="h-10" disabled={submitting || !couponInput.trim()} onClick={applyCoupon}>Aplicar</Button></div>{couponOffer ? <Button type="button" variant="ghost" className="mt-2 h-8 px-0 text-xs text-primary" disabled={submitting} onClick={() => { setCouponOffer(null); setCouponInput(""); setCouponMessage(""); setConsentAccepted(false); }}>Retirar cupón</Button> : null}<p className="mt-3 text-[10px] leading-5 text-muted-foreground">Promociones y cupones no se combinan. Conservamos la opción con mayor ahorro.</p>{couponMessage ? <p role="status" className="mt-3 text-xs leading-6 text-primary">{couponMessage}</p> : null}</section> : null}
        <OrderSummary quote={quote} editable={step === 0 && !submitting} onRemove={(bookId) => { setCart((current) => current.filter((item) => item.bookId !== bookId)); resetValidation(); }} />
          {step === 3 ? <OrderConsent accepted={consentAccepted} onAccepted={(value) => { setConsentAccepted(value); setErrorMessage(""); }} disabled={!consentAccepted || submitting || !submissionEnabled} pending={submitting} enabled={submissionEnabled} /> : null}
          <AccountBreakdown quote={quote} />
        </aside>
      </div>
    </div>
  );
}
