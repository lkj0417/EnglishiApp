import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { dailyPackAPI } from '../lib/api';
import { useDailyPackStore } from '../stores';

/**
 * useCompleteTask — 标记每日任务包中的任务为已完成
 * 同步更新本地 Zustand store + 触发服务器保存
 */
export function useCompleteTask() {
  const qc = useQueryClient();
  const markTaskComplete = useDailyPackStore(s => s.markTaskComplete);

  const completeTask = useCallback(
    async (taskId: string, timeSpentSec: number = 0) => {
      // 乐观更新本地状态（立即反馈）
      markTaskComplete(taskId);

      try {
        await dailyPackAPI.completeTask(taskId, { timeSpentSec });
        // 成功后刷新任务包缓存
        qc.invalidateQueries({ queryKey: ['daily-pack', 'today'] });
      } catch (err) {
        // 静默失败 — 本地状态已更新，下次同步时会修正
        console.warn('[useCompleteTask] Failed to sync task completion:', err);
      }
    },
    [markTaskComplete, qc],
  );

  return { completeTask };
}

