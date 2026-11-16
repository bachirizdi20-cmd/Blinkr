import React, { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors } from '../lib/theme';

/** Pull-to-refresh control that refreshes all active data queries on the visible screen. */
export default function AppRefreshControl({ onRefresh: refreshScreen }: { onRefresh?: () => Promise<unknown> | unknown }) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([queryClient.refetchQueries({ type: 'active' }), Promise.resolve(refreshScreen?.())]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, refreshing, refreshScreen]);

  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.surface} />;
}
