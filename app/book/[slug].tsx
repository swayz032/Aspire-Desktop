import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

interface BusinessProfile {
  id: string;
  name: string;
  businessName: string;
  logoUrl?: string | null;
  accentColor?: string | null;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price: number;
  currency: string;
  color: string;
  isActive: boolean;
}

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

type Step = 'services' | 'datetime' | 'details' | 'confirmation';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function PublicBookingPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [step, setStep] = useState<Step>('services');

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const accent = profile?.accentColor || '#3B82F6';

  useEffect(() => {
    if (slug) loadProfile();
  }, [slug]);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/book/${slug}`);
      if (!res.ok) {
        setError('This booking page could not be found.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setProfile(data.user);
      setServices(data.services || []);
      setAvailability(data.availability || []);
    } catch {
      setError('Unable to load booking page. Please try again.');
    }
    setLoading(false);
  };

  const getLogoUrl = (logoUrl: string | null | undefined): string | null => {
    if (!logoUrl) return null;
    if (logoUrl.startsWith('http')) return logoUrl;
    if (Platform.OS === 'web') return `${window.location.origin}${logoUrl}`;
    return logoUrl;
  };

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    if (amount === 0) return 'Free';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
  };

  const isDateAvailable = useCallback((date: Date) => {
    const dow = date.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;
    return availability.some(a => a.dayOfWeek === dow && a.isActive);
  }, [availability]);

  const getCalendarDays = useCallback(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  }, [calendarMonth]);

  const loadSlots = async (date: Date) => {
    if (!selectedService) return;
    setLoadingSlots(true);
    setSlots([]);
    try {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const res = await fetch(`${API_BASE}/api/book/${slug}/slots?serviceId=${selectedService.id}&date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
      }
    } catch {
      setSlots([]);
    }
    setLoadingSlots(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    loadSlots(date);
  };

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedSlot || !clientName || !clientEmail) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const [hours, mins] = selectedSlot.split(':').map(Number);
      const scheduledAt = new Date(selectedDate);
      scheduledAt.setHours(hours, mins, 0, 0);

      const res = await fetch(`${API_BASE}/api/book/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          scheduledAt: scheduledAt.toISOString(),
          clientName,
          clientEmail,
          clientPhone,
          clientNotes,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.checkoutUrl) {
          if (Platform.OS === 'web') window.location.href = result.checkoutUrl;
        } else {
          setBookingResult(result);
          setStep('confirmation');
        }
      } else {
        const errData = await res.json().catch(() => null);
        setSubmitError(errData?.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setSubmitError('Unable to complete your booking. Please check your connection and try again.');
    }
    setSubmitting(false);
  };

  const formatSlotTime = (slot: string) => {
    const [h, m] = slot.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
  };

  const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={s.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#6e6e73" />
        <Text style={s.errorText}>{error || 'Page not found'}</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <View style={s.brandHeader}>
            {getLogoUrl(profile.logoUrl) ? (
              <Image source={{ uri: getLogoUrl(profile.logoUrl)! }} style={s.logo} />
            ) : (
              <View style={[s.logoFallback, { backgroundColor: accent + '18' }]}>
                <Text style={[s.logoFallbackText, { color: accent }]}>{profile.businessName?.charAt(0) || 'B'}</Text>
              </View>
            )}
            <View style={s.brandInfo}>
              <Text style={s.brandName}>{profile.businessName}</Text>
              <Text style={s.brandSub}>Book an appointment</Text>
            </View>
          </View>

          {step !== 'confirmation' && (
            <View style={s.stepper}>
              {(['services', 'datetime', 'details'] as Step[]).map((s_step, i) => {
                const stepLabels = ['Service', 'Date & Time', 'Your Details'];
                const stepIndex = ['services', 'datetime', 'details'].indexOf(step);
                const isActive = i === stepIndex;
                const isDone = i < stepIndex;
                return (
                  <View key={s_step} style={s.stepItem}>
                    <View style={[s.stepDot, isActive && { backgroundColor: accent, borderColor: accent }, isDone && { backgroundColor: accent, borderColor: accent }]}>
                      {isDone ? (
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      ) : (
                        <Text style={[s.stepDotText, (isActive || isDone) && { color: '#fff' }]}>{i + 1}</Text>
                      )}
                    </View>
                    <Text style={[s.stepLabel, isActive && { color: '#f2f2f2' }]}>{stepLabels[i]}</Text>
                    {i < 2 && <View style={[s.stepLine, isDone && { backgroundColor: accent }]} />}
                  </View>
                );
              })}
            </View>
          )}

          {step === 'services' && (
            <View style={s.stepContent}>
              <Text style={s.sectionTitle}>Select a Service</Text>
              {services.length === 0 ? (
                <View style={s.emptyState}>
                  <Ionicons name="calendar-outline" size={40} color="#6e6e73" />
                  <Text style={s.emptyText}>No services available right now</Text>
                </View>
              ) : (
                services.map((svc) => {
                  const isSelected = selectedService?.id === svc.id;
                  return (
                    <Pressable
                      key={svc.id}
                      onPress={() => setSelectedService(svc)}
                      style={({ hovered }: any) => [
                        s.serviceCard,
                        isSelected && { borderColor: accent, backgroundColor: accent + '08' },
                        hovered && !isSelected && s.serviceCardHover,
                      ]}
                    >
                      <View style={[s.serviceColor, { backgroundColor: svc.color }]} />
                      <View style={s.serviceInfo}>
                        <Text style={s.serviceName}>{svc.name}</Text>
                        {svc.description ? <Text style={s.serviceDesc}>{svc.description}</Text> : null}
                        <View style={s.serviceMeta}>
                          <View style={s.serviceMetaItem}>
                            <Ionicons name="time-outline" size={13} color="#8e8e93" />
                            <Text style={s.serviceMetaText}>{svc.duration} min</Text>
                          </View>
                          <View style={s.serviceMetaItem}>
                            <Ionicons name="pricetag-outline" size={13} color="#8e8e93" />
                            <Text style={s.serviceMetaText}>{formatCurrency(svc.price, svc.currency)}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[s.serviceRadio, isSelected && { borderColor: accent }]}>
                        {isSelected && <View style={[s.serviceRadioInner, { backgroundColor: accent }]} />}
                      </View>
                    </Pressable>
                  );
                })
              )}
              {selectedService && (
                <Pressable style={[s.primaryBtn, { backgroundColor: accent }]} onPress={() => setStep('datetime')}>
                  <Text style={s.primaryBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </Pressable>
              )}
            </View>
          )}

          {step === 'datetime' && (
            <View style={s.stepContent}>
              <Pressable onPress={() => { setStep('services'); setSelectedDate(null); setSelectedSlot(null); }} style={s.backBtn}>
                <Ionicons name="arrow-back" size={16} color="#8e8e93" />
                <Text style={s.backBtnText}>Back</Text>
              </Pressable>

              <Text style={s.sectionTitle}>Choose Date & Time</Text>
              <View style={s.selectedServicePill}>
                <View style={[s.pillColor, { backgroundColor: selectedService?.color || accent }]} />
                <Text style={s.pillText}>{selectedService?.name} — {selectedService ? formatCurrency(selectedService.price, selectedService.currency) : ''}</Text>
              </View>

              <View style={s.calendar}>
                <View style={s.calendarHeader}>
                  <Pressable onPress={prevMonth} style={s.calNavBtn}>
                    <Ionicons name="chevron-back" size={18} color="#d1d1d6" />
                  </Pressable>
                  <Text style={s.calMonthLabel}>
                    {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </Text>
                  <Pressable onPress={nextMonth} style={s.calNavBtn}>
                    <Ionicons name="chevron-forward" size={18} color="#d1d1d6" />
                  </Pressable>
                </View>

                <View style={s.calDayLabels}>
                  {DAY_LABELS.map(d => <Text key={d} style={s.calDayLabel}>{d}</Text>)}
                </View>

                <View style={s.calGrid}>
                  {getCalendarDays().map((day, i) => {
                    if (!day) return <View key={`empty-${i}`} style={s.calCell} />;
                    const avail = isDateAvailable(day);
                    const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <Pressable
                        key={day.toISOString()}
                        onPress={() => avail && handleDateSelect(day)}
                        style={[
                          s.calCell,
                          avail && s.calCellAvail,
                          isSelected && { backgroundColor: accent, borderColor: accent },
                          isToday && !isSelected && { borderColor: accent + '60' },
                        ]}
                        disabled={!avail}
                      >
                        <Text style={[
                          s.calCellText,
                          !avail && s.calCellTextDisabled,
                          isSelected && { color: '#fff', fontWeight: '700' },
                          isToday && !isSelected && { color: accent },
                        ]}>
                          {day.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {selectedDate && (
                <View style={s.slotsSection}>
                  <Text style={s.slotsSectionTitle}>
                    Available Times — {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </Text>
                  {loadingSlots ? (
                    <ActivityIndicator size="small" color={accent} style={{ marginTop: 16 }} />
                  ) : slots.length === 0 ? (
                    <Text style={s.noSlotsText}>No available times for this date</Text>
                  ) : (
                    <View style={s.slotsGrid}>
                      {slots.map(slot => {
                        const isActive = selectedSlot === slot;
                        return (
                          <Pressable
                            key={slot}
                            onPress={() => setSelectedSlot(slot)}
                            style={({ hovered }: any) => [
                              s.slotBtn,
                              isActive && { backgroundColor: accent, borderColor: accent },
                              hovered && !isActive && { borderColor: '#4a4a4e', backgroundColor: '#1a1a1c' },
                            ]}
                          >
                            <Text style={[s.slotText, isActive && { color: '#fff', fontWeight: '600' }]}>
                              {formatSlotTime(slot)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {selectedSlot && (
                <Pressable style={[s.primaryBtn, { backgroundColor: accent }]} onPress={() => setStep('details')}>
                  <Text style={s.primaryBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </Pressable>
              )}
            </View>
          )}

          {step === 'details' && (
            <View style={s.stepContent}>
              <Pressable onPress={() => setStep('datetime')} style={s.backBtn}>
                <Ionicons name="arrow-back" size={16} color="#8e8e93" />
                <Text style={s.backBtnText}>Back</Text>
              </Pressable>

              <Text style={s.sectionTitle}>Your Details</Text>

              <View style={s.summaryCard}>
                <View style={s.summaryRow}>
                  <Ionicons name="briefcase-outline" size={15} color="#8e8e93" />
                  <Text style={s.summaryText}>{selectedService?.name}</Text>
                </View>
                <View style={s.summaryRow}>
                  <Ionicons name="calendar-outline" size={15} color="#8e8e93" />
                  <Text style={s.summaryText}>
                    {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </Text>
                </View>
                <View style={s.summaryRow}>
                  <Ionicons name="time-outline" size={15} color="#8e8e93" />
                  <Text style={s.summaryText}>{selectedSlot ? formatSlotTime(selectedSlot) : ''} — {selectedService?.duration} min</Text>
                </View>
                <View style={s.summaryRow}>
                  <Ionicons name="pricetag-outline" size={15} color="#8e8e93" />
                  <Text style={[s.summaryText, { color: accent, fontWeight: '600' }]}>
                    {selectedService ? formatCurrency(selectedService.price, selectedService.currency) : ''}
                  </Text>
                </View>
              </View>

              <View style={s.formGroup}>
                <Text style={s.label}>Full Name <Text style={{ color: '#ef4444' }}>*</Text></Text>
                <TextInput style={s.input} value={clientName} onChangeText={setClientName} placeholder="John Smith" placeholderTextColor="#48484a" />
              </View>
              <View style={s.formGroup}>
                <Text style={s.label}>Email <Text style={{ color: '#ef4444' }}>*</Text></Text>
                <TextInput style={s.input} value={clientEmail} onChangeText={setClientEmail} placeholder="john@example.com" placeholderTextColor="#48484a" keyboardType="email-address" autoCapitalize="none" />
              </View>
              <View style={s.formGroup}>
                <Text style={s.label}>Phone</Text>
                <TextInput style={s.input} value={clientPhone} onChangeText={setClientPhone} placeholder="+1 (555) 000-0000" placeholderTextColor="#48484a" keyboardType="phone-pad" />
              </View>
              <View style={s.formGroup}>
                <Text style={s.label}>Notes</Text>
                <TextInput style={[s.input, s.textArea]} value={clientNotes} onChangeText={setClientNotes} placeholder="Anything we should know..." placeholderTextColor="#48484a" multiline numberOfLines={3} />
              </View>

              {submitError && (
                <View style={s.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text style={s.errorBannerText}>{submitError}</Text>
                </View>
              )}

              <Pressable
                style={[s.primaryBtn, { backgroundColor: accent }, (!clientName || !clientEmail) && { opacity: 0.5 }]}
                onPress={handleSubmit}
                disabled={!clientName || !clientEmail || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={s.primaryBtnText}>
                      {selectedService && selectedService.price > 0 ? 'Continue to Payment' : 'Confirm Booking'}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>
          )}

          {step === 'confirmation' && (
            <View style={s.stepContent}>
              <View style={s.confirmationContainer}>
                <View style={[s.confirmIcon, { backgroundColor: '#22c55e18' }]}>
                  <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
                </View>
                <Text style={s.confirmTitle}>Booking Confirmed!</Text>
                <Text style={s.confirmSub}>You're all set. A confirmation has been sent to {clientEmail}.</Text>

                <View style={[s.summaryCard, { marginTop: 24 }]}>
                  <View style={s.summaryRow}>
                    <Ionicons name="briefcase-outline" size={15} color="#8e8e93" />
                    <Text style={s.summaryText}>{selectedService?.name}</Text>
                  </View>
                  <View style={s.summaryRow}>
                    <Ionicons name="calendar-outline" size={15} color="#8e8e93" />
                    <Text style={s.summaryText}>
                      {selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={s.summaryRow}>
                    <Ionicons name="time-outline" size={15} color="#8e8e93" />
                    <Text style={s.summaryText}>{selectedSlot ? formatSlotTime(selectedSlot) : ''}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        <Text style={s.poweredBy}>Powered by Aspire</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    minHeight: '100%' as any,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    color: '#8e8e93',
    fontSize: 16,
    marginTop: 12,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: '#111113',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { boxShadow: '0 8px 40px rgba(0,0,0,0.5)' } as any : {}),
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  logoFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackText: {
    fontSize: 20,
    fontWeight: '700',
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    color: '#f2f2f2',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandSub: {
    color: '#8e8e93',
    fontSize: 13,
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#3C3C3E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stepDotText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6e6e73',
  },
  stepLabel: {
    fontSize: 12,
    color: '#6e6e73',
    fontWeight: '500',
  },
  stepLine: {
    width: 32,
    height: 1,
    backgroundColor: '#2C2C2E',
    marginHorizontal: 8,
  },
  stepContent: {
    padding: 24,
  },
  sectionTitle: {
    color: '#f2f2f2',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: '#6e6e73',
    fontSize: 14,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    marginBottom: 10,
    gap: 14,
    ...(Platform.OS === 'web' ? { transition: 'all 0.15s ease-out', cursor: 'pointer' } as any : {}),
  },
  serviceCardHover: {
    borderColor: '#3C3C3E',
    backgroundColor: '#1a1a1c',
  },
  serviceColor: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    color: '#f2f2f2',
    fontSize: 15,
    fontWeight: '600',
  },
  serviceDesc: {
    color: '#8e8e93',
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  serviceMeta: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 8,
  },
  serviceMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceMetaText: {
    color: '#8e8e93',
    fontSize: 12,
  },
  serviceRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3C3C3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'opacity 0.15s ease-out' } as any : {}),
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
  },
  backBtnText: {
    color: '#8e8e93',
    fontSize: 13,
  },
  selectedServicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pillColor: {
    width: 3,
    height: 20,
    borderRadius: 2,
  },
  pillText: {
    color: '#d1d1d6',
    fontSize: 13,
    fontWeight: '500',
  },
  calendar: {
    backgroundColor: '#161618',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  calNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
  },
  calMonthLabel: {
    color: '#f2f2f2',
    fontSize: 15,
    fontWeight: '600',
  },
  calDayLabels: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calDayLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#6e6e73',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: '14.28%' as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  calCellAvail: {
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
  },
  calCellText: {
    color: '#d1d1d6',
    fontSize: 14,
    fontWeight: '500',
  },
  calCellTextDisabled: {
    color: '#3C3C3E',
  },
  slotsSection: {
    marginTop: 20,
  },
  slotsSectionTitle: {
    color: '#d1d1d6',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  noSlotsText: {
    color: '#6e6e73',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    backgroundColor: '#141414',
    ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'all 0.12s ease-out' } as any : {}),
  },
  slotText: {
    color: '#d1d1d6',
    fontSize: 13,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#161618',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 12,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryText: {
    color: '#d1d1d6',
    fontSize: 14,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#a1a1a6',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#161618',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f2f2f2',
    fontSize: 14,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  confirmationContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  confirmIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  confirmTitle: {
    color: '#f2f2f2',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  confirmSub: {
    color: '#8e8e93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  errorBannerText: {
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
  },
  poweredBy: {
    color: '#3C3C3E',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
});
