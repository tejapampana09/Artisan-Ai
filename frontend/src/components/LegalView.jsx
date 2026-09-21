import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, FileText, Lock, RefreshCw, Mail, Phone, MapPin, 
  Clock, ArrowLeft, Send, CheckCircle2, AlertCircle, HelpCircle,
  Sparkles, ExternalLink
} from 'lucide-react';

export default function LegalView({ initialTab = 'TERMS', onSelectMode }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Support',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;
    setSubmitted(true);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-20 font-sans space-y-8 animate-fade-in">
      {/* Back Button & Header */}
      <div className="space-y-4">
        <button
          onClick={() => onSelectMode('HOME')}
          className="inline-flex items-center space-x-2 text-xs font-semibold text-[#6B6B6B] hover:text-[#A6533B] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Marketplace</span>
        </button>

        <div className="bg-gradient-to-r from-stone-900 via-[#2A1E17] to-[#A6533B] rounded-2xl p-6 sm:p-8 text-white shadow-md">
          <div className="flex items-center space-x-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Artisan AI Trust & Transparency</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold font-serif-luxury tracking-tight">
            Policies, Legal & Support Hub
          </h1>
          <p className="text-xs sm:text-sm text-stone-200 mt-2 max-w-2xl leading-relaxed">
            Our fair-trade marketplace connects authentic rural Indian artisans directly with global patrons, guided by consumer protection, intellectual property safeguards, and absolute transparency.
          </p>
        </div>
      </div>

      {/* Tab Navigation Pill Selector */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-[#E8E5DF] rounded-xl shadow-2xs">
        <button
          onClick={() => setActiveTab('TERMS')}
          className={`flex-1 min-w-[130px] flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'TERMS'
              ? 'bg-[#A6533B] text-white shadow-xs'
              : 'text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#FAF9F6]'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Terms of Service</span>
        </button>

        <button
          onClick={() => setActiveTab('PRIVACY')}
          className={`flex-1 min-w-[130px] flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'PRIVACY'
              ? 'bg-[#A6533B] text-white shadow-xs'
              : 'text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#FAF9F6]'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Privacy Policy</span>
        </button>

        <button
          onClick={() => setActiveTab('REFUND')}
          className={`flex-1 min-w-[150px] flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'REFUND'
              ? 'bg-[#A6533B] text-white shadow-xs'
              : 'text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#FAF9F6]'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refund & Cancellation</span>
        </button>

        <button
          onClick={() => setActiveTab('CONTACT')}
          className={`flex-1 min-w-[130px] flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'CONTACT'
              ? 'bg-[#A6533B] text-white shadow-xs'
              : 'text-[#6B6B6B] hover:text-[#1C1C1C] hover:bg-[#FAF9F6]'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Contact & Support</span>
        </button>
      </div>

      {/* Tab Content Panels */}
      <div className="bg-white border border-[#E8E5DF] rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
        {/* TAB 1: TERMS OF SERVICE */}
        {activeTab === 'TERMS' && (
          <div className="space-y-6 text-[#1C1C1C]">
            <div className="border-b border-[#E8E5DF] pb-4">
              <h2 className="text-xl sm:text-2xl font-bold font-serif-luxury text-[#1C1C1C]">
                Terms of Service
              </h2>
              <p className="text-xs text-[#6B6B6B] mt-1">
                Effective Date: January 1, 2026 • Last updated: September 2026
              </p>
            </div>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">1. Platform Overview & Fair Trade Agreement</h3>
              <p>
                Welcome to <strong>Artisan AI</strong> ("Platform", "we", "our"). Artisan AI operates as an authentic direct-to-consumer and business-to-business marketplace dedicated to empowering rural Indian craftsmen, weavers, and heritage artisans. By accessing or using our website, services, and mobile applications, you agree to be bound by these Terms of Service in compliance with the Information Technology Act, 2000 and the Consumer Protection (E-Commerce) Rules, 2020 of India.
              </p>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">2. Authentic Handmade Nature & GI Tag Authenticity</h3>
              <p>
                Every product showcased on Artisan AI is handcrafted by genuine rural artisans across clusters including Kalamkari (Andhra Pradesh), Bidriware (Karnataka), Etikoppaka lacquer (Andhra Pradesh), Jaipur Blue Pottery (Rajasthan), and Pochampally Ikat (Telangana).
              </p>
              <div className="p-3 bg-[#FAF9F6] border border-[#E8E5DF] rounded-xl text-xs text-[#6B6B6B] space-y-1">
                <span className="font-bold text-[#1C1C1C] block">Handmade Distinction Notice:</span>
                Due to the genuine handmade process utilizing vegetable dyes, clay molds, hand-chiseling, and loom-weaving, minor variations in texture, hue, weave tension, and sizing are expected characteristics of artisanal uniqueness, not defects.
              </div>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">3. Fair Margin Guard & Transparent Pricing</h3>
              <p>
                Artisan AI implements an algorithmic <strong>Cost-Plus Fair Margin Formula</strong> ensuring artisans receive a mandatory profit floor (minimum 20% over material and artisan labor costs). Buyers agree that listed prices directly remunerate rural creators without middleman markups.
              </p>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">4. Artisan & Buyer Conduct</h3>
              <p>
                Sellers represent and warrant that all items listed are their authentic handmade creations and do not violate intellectual property laws or counterfeit GI certifications. Buyers agree to use enquiry channels respectfully and honor fair business practices.
              </p>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">5. Governing Law & Dispute Redressal</h3>
              <p>
                These terms are governed by the laws of the Republic of India. Any legal disputes arising out of transactions shall be subject to the exclusive jurisdiction of the courts located in Hyderabad, Telangana, India.
              </p>
            </section>
          </div>
        )}

        {/* TAB 2: PRIVACY POLICY */}
        {activeTab === 'PRIVACY' && (
          <div className="space-y-6 text-[#1C1C1C]">
            <div className="border-b border-[#E8E5DF] pb-4">
              <h2 className="text-xl sm:text-2xl font-bold font-serif-luxury text-[#1C1C1C]">
                Privacy Policy
              </h2>
              <p className="text-xs text-[#6B6B6B] mt-1">
                Committed to protecting creator and buyer privacy under Indian Digital Personal Data Protection (DPDP) Act.
              </p>
            </div>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">1. Information We Collect</h3>
              <p>We collect only the minimum data required to facilitate authentic fair-trade transactions:</p>
              <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                <li><strong>Buyer Information:</strong> Name, delivery address, contact email, phone number, and transaction identifiers.</li>
                <li><strong>Artisan Information:</strong> Creator name, craft heritage discipline, cluster location, verified bank/UPI account details for direct payments, and identity verification credentials.</li>
                <li><strong>Voice AI Recordings:</strong> Spoken audio recorded by artisans in regional languages (Telugu, Hindi, Tamil, Bengali) solely to transcribe product titles and descriptions.</li>
              </ul>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">2. Voice Data Protection & Gemini AI Safeguards</h3>
              <p>
                Artisan voice audio recordings submitted through the Voice Cataloging Studio are processed securely using Google Gemini API. Voice samples are strictly used for instant catalog generation and are never sold, monetized, or shared with third-party advertising brokers.
              </p>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">3. Payment Gateway Security</h3>
              <p>
                Artisan AI does not store sensitive card numbers or CVVs. All payments are processed through PCI-DSS Level 1 certified gateways (Razorpay, UPI, Net Banking) utilizing 256-bit encryption.
              </p>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">4. Grievance Officer</h3>
              <p>
                In accordance with Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, our appointed Grievance Officer can be contacted at <strong>grievance@artisan-ai.in</strong>.
              </p>
            </section>
          </div>
        )}

        {/* TAB 3: CANCELLATION & REFUND POLICY */}
        {activeTab === 'REFUND' && (
          <div className="space-y-6 text-[#1C1C1C]">
            <div className="border-b border-[#E8E5DF] pb-4">
              <h2 className="text-xl sm:text-2xl font-bold font-serif-luxury text-[#1C1C1C]">
                Cancellation & Refund Policy
              </h2>
              <p className="text-xs text-[#6B6B6B] mt-1">
                Balancing customer satisfaction with direct protection for rural artisan livelihoods.
              </p>
            </div>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">1. Order Cancellation Window</h3>
              <p>
                Orders may be cancelled free of charge within <strong>12 hours</strong> of placement, provided the artisan has not dispatched the consignment. Once dispatched or custom-made, cancellations cannot be processed.
              </p>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">2. 7-Day Return & Replacement Guarantee</h3>
              <p>
                We offer a hassle-free <strong>7-day replacement or refund</strong> under the following conditions:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-1">
                  <span className="font-bold text-rose-900 text-xs flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Eligible for Return / Refund</span>
                  </span>
                  <ul className="text-[11px] text-rose-800 list-disc pl-4 space-y-0.5">
                    <li>Item damaged or broken during transit</li>
                    <li>Incorrect product received</li>
                    <li>Significant structural defect not characteristic of handmade art</li>
                  </ul>
                </div>

                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1">
                  <span className="font-bold text-stone-800 text-xs flex items-center space-x-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-stone-500" />
                    <span>Non-Eligible Reasons</span>
                  </span>
                  <ul className="text-[11px] text-stone-600 list-disc pl-4 space-y-0.5">
                    <li>Minor organic dye shade variations</li>
                    <li>Slight wood grain or hand-carving differences</li>
                    <li>Custom commissioned or bespoke personalized items</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">3. Return Process</h3>
              <p>
                To initiate a return, photograph the packaging and defective item within 48 hours of delivery and submit a request via our Contact Hub or by email to <strong>support@artisan-ai.in</strong> with your Order ID. Our rural logistics partner will arrange pickup.
              </p>
            </section>

            <section className="space-y-3 text-xs sm:text-sm text-[#4A4A4A] leading-relaxed">
              <h3 className="text-sm sm:text-base font-bold text-[#1C1C1C]">4. Refund Timelines</h3>
              <p>
                Once approved, refunds are credited back to the original payment source within <strong>5 to 7 business days</strong>. For COD orders, direct NEFT/UPI transfer is completed upon verification.
              </p>
            </section>
          </div>
        )}

        {/* TAB 4: CONTACT US & CUSTOMER SUPPORT */}
        {activeTab === 'CONTACT' && (
          <div className="space-y-8">
            <div className="border-b border-[#E8E5DF] pb-4">
              <h2 className="text-xl sm:text-2xl font-bold font-serif-luxury text-[#1C1C1C]">
                Contact Us & Customer Support
              </h2>
              <p className="text-xs text-[#6B6B6B] mt-1">
                Our support team is here to assist buyers, wholesale clients, and artisan partners.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Contact Card 1: Email */}
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E5DF] space-y-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-[#A6533B] flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#1C1C1C] uppercase tracking-wider">Email Us</h4>
                <p className="text-xs text-[#6B6B6B]">For orders, questions, and partnerships:</p>
                <a 
                  href="mailto:support@artisan-ai.in" 
                  className="text-xs font-bold text-[#A6533B] hover:underline block pt-1"
                >
                  support@artisan-ai.in
                </a>
              </div>

              {/* Contact Card 2: Phone */}
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E5DF] space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#1C1C1C] uppercase tracking-wider">Toll-Free Helpline</h4>
                <p className="text-xs text-[#6B6B6B]">Mon to Sat, 9:00 AM – 7:00 PM IST:</p>
                <a 
                  href="tel:+918002784726" 
                  className="text-xs font-bold text-emerald-800 hover:underline block pt-1"
                >
                  1800-278-4726 (1800-ARTISAN)
                </a>
              </div>

              {/* Contact Card 3: Location */}
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E8E5DF] space-y-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-[#1C1C1C] uppercase tracking-wider">Heritage Craft Center</h4>
                <p className="text-xs text-[#6B6B6B] leading-relaxed">
                  Artisan AI Hub, Jubilee Hills, Hyderabad, Telangana 500033, India
                </p>
              </div>
            </div>

            {/* Interactive Support Ticket / Enquiry Form */}
            <div className="p-6 bg-[#FAF9F6] border border-[#E8E5DF] rounded-2xl space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-base text-[#1C1C1C]">Send an Online Message</h3>
                <p className="text-xs text-[#6B6B6B]">
                  Have an enquiry about an order, an artisan story, or bulk export requirements? We reply within 24 hours.
                </p>
              </div>

              {submitted ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-900">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-sm">Thank you, message received!</p>
                    <p>Our craft support specialist will review your request and get back to you at <strong>{contactForm.email}</strong> shortly.</p>
                    <button 
                      onClick={() => setSubmitted(false)}
                      className="mt-2 text-xs font-bold underline cursor-pointer text-emerald-800"
                    >
                      Send another message
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1C1C1C] mb-1">Your Name *</label>
                      <input 
                        type="text" 
                        required
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        placeholder="e.g. Priya Sharma"
                        className="w-full text-xs p-2.5 rounded-lg border border-[#E8E5DF] bg-white focus:outline-none focus:border-[#A6533B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1C1C1C] mb-1">Email Address *</label>
                      <input 
                        type="email" 
                        required
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        placeholder="priya@example.com"
                        className="w-full text-xs p-2.5 rounded-lg border border-[#E8E5DF] bg-white focus:outline-none focus:border-[#A6533B]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1C1C1C] mb-1">Phone Number (Optional)</label>
                      <input 
                        type="tel" 
                        value={contactForm.phone}
                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        placeholder="+91 98765 43210"
                        className="w-full text-xs p-2.5 rounded-lg border border-[#E8E5DF] bg-white focus:outline-none focus:border-[#A6533B]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1C1C1C] mb-1">Inquiry Category</label>
                      <select 
                        value={contactForm.subject}
                        onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-lg border border-[#E8E5DF] bg-white focus:outline-none focus:border-[#A6533B]"
                      >
                        <option value="General Support">General Support & Information</option>
                        <option value="Order Tracking">Order & Tracking Assistance</option>
                        <option value="Returns & Refunds">Returns & Refund Request</option>
                        <option value="Wholesale Inquiry">Wholesale / Custom Bulk Orders</option>
                        <option value="Artisan Onboarding">Artisan Partnership / Join Us</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1C1C1C] mb-1">Message *</label>
                    <textarea 
                      rows={4}
                      required
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="Please describe how we can assist you..."
                      className="w-full text-xs p-2.5 rounded-lg border border-[#E8E5DF] bg-white focus:outline-none focus:border-[#A6533B]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#A6533B] hover:bg-[#88412F] text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer inline-flex items-center space-x-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message</span>
                  </button>
                </form>
              )}
            </div>

            {/* Quick Support FAQs */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-sm text-[#1C1C1C] flex items-center space-x-1.5">
                <HelpCircle className="w-4 h-4 text-[#A6533B]" />
                <span>Frequently Asked Questions</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-[#E8E5DF] bg-white space-y-1">
                  <h4 className="font-bold text-[#1C1C1C]">How do I track my order?</h4>
                  <p className="text-[#6B6B6B]">
                    Visit <strong>My Orders</strong> in the top navigation or account menu. You can track live courier dispatch updates for each artisan package.
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-[#E8E5DF] bg-white space-y-1">
                  <h4 className="font-bold text-[#1C1C1C]">Are your artisans verified?</h4>
                  <p className="text-[#6B6B6B]">
                    Yes! Every creator is physically verified through regional craft cooperatives, GI tag registries, and master artisan guild records.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
