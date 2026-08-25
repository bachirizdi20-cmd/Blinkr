import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import EmptyState from '../components/EmptyState';
import { ContentStackParamList } from '../navigation/types';
import { useLibrary } from '../context/LibraryContext';
import { colors, fontSizes, radius, spacing } from '../lib/theme';

type RouteT = RouteProp<ContentStackParamList, 'AddToList'>;

export default function AddToListScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteT>();
  const { mediaType, mediaId, title, posterPath, genreIds } = route.params;
  const lib = useLibrary();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = lib.createList(newName.trim(), '');
    lib.toggleItemInList(id, { mediaType, mediaId, title, posterPath, genreIds });
    setNewName('');
    setCreating(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.doneText}>Close</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add to List</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={styles.mediaTitle} numberOfLines={1}>{title}</Text>

      {creating ? (
        <View style={styles.createRow}>
          <TextInput
            style={styles.input}
            placeholder="New list name"
            placeholderTextColor={colors.textFaint}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            onSubmitEditing={handleCreate}
            returnKeyType="done"
          />
          <Pressable style={styles.createBtn} onPress={handleCreate}>
            <Text style={styles.createBtnText}>Create</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.newListRow} onPress={() => setCreating(true)}>
          <Ionicons name="add-circle" size={22} color={colors.accent} />
          <Text style={styles.newListText}>Create New List</Text>
        </Pressable>
      )}

      <FlatList
        data={lib.lists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={<EmptyState icon="list-outline" title="No lists yet" message="Create your first list above." />}
        renderItem={({ item }) => {
          const included = lib.isItemInList(item.id, mediaType, mediaId);
          return (
            <Pressable
              style={styles.listRow}
              onPress={() => lib.toggleItemInList(item.id, { mediaType, mediaId, title, posterPath, genreIds })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.listName}>{item.name}</Text>
                <Text style={styles.listCount}>{item.items.length} title{item.items.length !== 1 ? 's' : ''}</Text>
              </View>
              <Ionicons
                name={included ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={included ? colors.accent : colors.textFaint}
              />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  doneText: { color: colors.textDim, fontSize: fontSizes.md },
  headerTitle: { color: colors.text, fontSize: fontSizes.md, fontWeight: '800' },
  mediaTitle: { color: colors.textDim, fontSize: fontSizes.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md, fontWeight: '600' },
  newListRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  newListText: { color: colors.accent, fontSize: fontSizes.md, fontWeight: '700' },
  createRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, color: colors.text, borderWidth: 1, borderColor: colors.border },
  createBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4 },
  createBtnText: { color: '#04120C', fontWeight: '800' },
  listRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  listName: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' },
  listCount: { color: colors.textFaint, fontSize: fontSizes.xs, marginTop: 2 },
});
