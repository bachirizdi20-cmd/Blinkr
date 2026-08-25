import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary, UserList } from '../context/LibraryContext';
import { posterUrl } from '../lib/tmdb';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type Nav = NativeStackNavigationProp<ContentStackParamList>;

export default function ListsScreen() {
  const navigation = useNavigation<Nav>();
  const lib = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    const id = lib.createList(name.trim(), desc.trim());
    setName('');
    setDesc('');
    setCreating(false);
    navigation.navigate('ListDetail', { listId: id });
  };

  const handleDelete = (item: UserList) => {
    Alert.alert('Delete list', `Delete "${item.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => lib.deleteList(item.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Your Lists</Text>
        <Pressable style={styles.addBtn} onPress={() => setCreating((v) => !v)}>
          <Ionicons name={creating ? 'close' : 'add'} size={22} color={colors.text} />
        </Pressable>
      </View>

      {creating && (
        <View style={styles.createBox}>
          <TextInput
            style={styles.input}
            placeholder="List name"
            placeholderTextColor={colors.textFaint}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <TextInput
            style={[styles.input, { marginTop: spacing.sm }]}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textFaint}
            value={desc}
            onChangeText={setDesc}
          />
          <Pressable style={styles.createBtn} onPress={handleCreate}>
            <Text style={styles.createBtnText}>Create List</Text>
          </Pressable>
        </View>
      )}

      {lib.lists.length === 0 && !creating ? (
        <EmptyState icon="list-outline" title="No lists yet" message="Tap + to create your first curated list." />
      ) : (
        <FlatList
          data={lib.lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
              onLongPress={() => handleDelete(item)}
            >
              <View style={styles.coverRow}>
                {item.items.slice(0, 4).map((it, idx) => (
                  <Image key={idx} source={{ uri: posterUrl(it.posterPath, 'w200') ?? undefined }} style={[styles.cover, { marginLeft: idx === 0 ? 0 : -20 }]} contentFit="cover" />
                ))}
                {item.items.length === 0 && (
                  <View style={[styles.cover, styles.coverEmpty]}>
                    <Ionicons name="film-outline" size={22} color={colors.textFaint} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                {!!item.description && <Text style={styles.listDesc} numberOfLines={1}>{item.description}</Text>}
                <Text style={styles.listCount}>{item.items.length} title{item.items.length !== 1 ? 's' : ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  header: { color: colors.text, fontSize: fontSizes.xxl, fontWeight: '800' },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  createBox: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, color: colors.text, borderWidth: 1, borderColor: colors.border },
  createBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center', marginTop: spacing.sm },
  createBtnText: { color: '#04120C', fontWeight: '800' },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  coverRow: { flexDirection: 'row' },
  cover: { width: 44, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh, borderWidth: 2, borderColor: colors.bg },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  listName: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  listDesc: { color: colors.textDim, fontSize: fontSizes.xs, marginTop: 2 },
  listCount: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
});
