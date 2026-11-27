import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ContentStackParamList } from '../navigation/types';
import { trpc } from '../lib/trpc';
import { useAuth } from '../hooks/use-auth';
import { colors, radius, spacing } from '../lib/theme';
import { PlatformAlert as Alert } from '../lib/platform-alert';

type Nav = NativeStackNavigationProp<ContentStackParamList>;
type RouteT = RouteProp<ContentStackParamList, 'GameDetail'>;

export default function GameDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteT>();
  const id = Number(route.params.id);
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const detail = trpc.games.detail.useQuery({ id }, { enabled: id > 0, retry: 1 });
  const shots = trpc.games.screenshots.useQuery({ id, page: 1 }, { enabled: id > 0, retry: 1 });
  const mine = trpc.reviews.getMine.useQuery({ mediaType: 'game', mediaId: id }, { enabled: !!user && id > 0, retry: false });
  const status = trpc.library.getStatus.useQuery({ mediaType: 'game', mediaId: id }, { enabled: !!user && id > 0, retry: false });
  const save = trpc.reviews.save.useMutation();
  const setStatus = trpc.library.setStatus.useMutation();
  const removeStatus = trpc.library.removeStatus.useMutation();
  const game = detail.data ?? route.params.game;
  const title = game?.name ?? 'اللعبة';
  const poster = game?.background_image ?? null;
  const saved = status.data?.status === 'watchlist';
  const completed = status.data?.status === 'watched';
  const saveReview = async () => {
    if (!user) { Alert.alert('يلزم تسجيل الدخول', 'سجّل الدخول لحفظ تقييمك ومراجعتك.'); return; }
    if (!rating && !review.trim()) { Alert.alert('أضف تقييمًا أو مراجعة', 'اختر تقييمًا أو اكتب رأيك أولًا.'); return; }
    try {
      await save.mutateAsync({ mediaType: 'game', mediaId: id, title, posterPath: poster, rating, review: review.trim(), spoiler: false, watchedDate: new Date().toISOString() });
      await mine.refetch();
      Alert.alert('تم الحفظ', 'تم حفظ تقييم اللعبة ومراجعتك.');
    } catch { Alert.alert('تعذر الحفظ', 'تحقق من الاتصال وحاول مجددًا.'); }
  };
  const toggle = async (next: 'watchlist' | 'watched') => {
    if (!user) { Alert.alert('يلزم تسجيل الدخول', 'سجّل الدخول لحفظ الألعاب في مكتبتك.'); return; }
    const active = next === 'watchlist' ? saved : completed;
    try {
      if (active) await removeStatus.mutateAsync({ mediaType: 'game', mediaId: id });
      else await setStatus.mutateAsync({ mediaType: 'game', mediaId: id, title, posterPath: poster, status: next });
      await status.refetch();
    } catch { Alert.alert('تعذر تحديث المكتبة', 'حاول مرة أخرى بعد التحقق من الاتصال.'); }
  };
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <View style={styles.top}><Pressable onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={25} color={colors.text} /></Pressable><Text style={styles.topTitle}>تفاصيل اللعبة</Text><View style={{width:25}} /></View>
    {detail.isLoading && !game ? <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.muted}>جارٍ تحميل بيانات اللعبة…</Text></View> :
    detail.isError && !game ? <View style={styles.center}><Text style={styles.title}>تعذر تحميل اللعبة</Text><Pressable onPress={() => detail.refetch()}><Text style={styles.actionText}>إعادة المحاولة</Text></Pressable></View> :
    <ScrollView contentContainerStyle={styles.content}>
      {poster ? <Image source={{uri:poster}} style={styles.hero} contentFit="cover" /> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.muted}>★ {Number(game?.rating ?? 0).toFixed(1)} / 5 · {game?.released ?? 'تاريخ الإصدار غير متاح'}</Text>
      <Text style={styles.description}>{game?.description_raw ?? 'لا يتوفر وصف لهذه اللعبة حاليًا.'}</Text>
      <Text style={styles.section}>الأنواع: {(game?.genres ?? []).map((g:any)=>g.name).join('، ') || 'غير متاحة'}</Text>
      <Text style={styles.section}>المنصات: {(game?.platforms ?? []).map((p:any)=>p.platform?.name).filter(Boolean).slice(0,8).join('، ') || 'غير متاحة'}</Text>
      {shots.data?.results?.length ? <><Text style={styles.section}>صور من اللعبة</Text><ScrollView horizontal>{shots.data.results.map((shot:any)=><Image key={shot.id} source={{uri:shot.image}} style={styles.shot} contentFit="cover" />)}</ScrollView></> : null}
      <Text style={styles.section}>مكتبتك</Text>
      <View style={styles.row}>
        <Pressable style={[styles.action, saved && styles.active]} onPress={()=>void toggle('watchlist')}><Text style={[styles.actionText,saved&&styles.activeText]}>{saved?'في قائمة التجربة':'أريد تجربتها'}</Text></Pressable>
        <Pressable style={[styles.action, completed && styles.active]} onPress={()=>void toggle('watched')}><Text style={[styles.actionText,completed&&styles.activeText]}>{completed?'تمت تجربتها':'تمت تجربتها'}</Text></Pressable>
      </View>
      <Text style={styles.section}>تقييمك من 10</Text>
      <View style={styles.rating}>{Array.from({length:10},(_,i)=>i+1).map(n=><Pressable key={n} onPress={()=>setRating(n)} style={[styles.rateCell,(rating||mine.data?.rating||0)>=n&&styles.active]}><Text style={[styles.rateText,(rating||mine.data?.rating||0)>=n&&styles.activeText]}>{n}</Text></Pressable>)}</View>
      <TextInput value={review || mine.data?.review || ''} onChangeText={setReview} placeholder="اكتب مراجعتك عن اللعبة…" placeholderTextColor={colors.textFaint} multiline style={styles.input} />
      <Pressable onPress={()=>void saveReview()} style={styles.save}><Text style={styles.activeText}>{save.isPending?'جارٍ الحفظ…':'حفظ التقييم والمراجعة'}</Text></Pressable>
    </ScrollView>}
  </SafeAreaView>;
}
const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:colors.bg},top:{height:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:spacing.md,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},topTitle:{color:colors.text,fontWeight:'700',fontSize:16},content:{padding:spacing.md,paddingBottom:40,gap:spacing.md},hero:{width:'100%',height:220,borderRadius:radius.lg,backgroundColor:colors.surface},title:{fontSize:25,fontWeight:'800',color:colors.text},muted:{color:colors.textMuted,fontSize:13},description:{color:colors.text,fontSize:14,lineHeight:23},section:{color:colors.text,fontSize:16,fontWeight:'800',marginTop:8},shot:{width:230,height:130,borderRadius:radius.md,marginRight:10},row:{flexDirection:'row',gap:10},action:{flex:1,minHeight:46,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,alignItems:'center',justifyContent:'center'},active:{backgroundColor:colors.accent,borderColor:colors.accent},actionText:{color:colors.accent,fontWeight:'700'},activeText:{color:colors.bg,fontWeight:'800'},rating:{flexDirection:'row',flexWrap:'wrap',gap:6},rateCell:{width:29,height:34,borderRadius:8,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},rateText:{color:colors.text,fontSize:12,fontWeight:'700'},input:{minHeight:110,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:12,color:colors.text,textAlignVertical:'top',backgroundColor:colors.surface},save:{minHeight:48,borderRadius:radius.md,alignItems:'center',justifyContent:'center',backgroundColor:colors.accent},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12}
});
