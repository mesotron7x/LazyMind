package modelprovider

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"lazymind/core/common/orm"
)

// resolveUserModelProvider accepts the canonical user_model_providers.id and
// also tolerates catalog/default IDs or provider-name slugs from older/static UIs.
func resolveUserModelProvider(ctx context.Context, db *gorm.DB, userID, userName, ref string) (orm.UserModelProvider, error) {
	ref = strings.TrimSpace(ref)
	var row orm.UserModelProvider
	if ref == "" {
		return row, gorm.ErrRecordNotFound
	}

	err := db.WithContext(ctx).
		Select(providerListSelectColumns).
		Where("id = ? AND create_user_id = ? AND deleted_at IS NULL", ref, userID).
		Take(&row).Error
	if err == nil {
		return row, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return row, err
	}

	// Make sure newly added catalog providers exist for this user before falling
	// back to default_model_provider_id/name matching.
	if syncErr := syncUserProvidersFromDefaults(ctx, db, userID, userName); syncErr != nil {
		return row, syncErr
	}

	err = db.WithContext(ctx).
		Select(providerListSelectColumns).
		Where("id = ? AND create_user_id = ? AND deleted_at IS NULL", ref, userID).
		Take(&row).Error
	if err == nil {
		return row, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return row, err
	}

	var rows []orm.UserModelProvider
	if err := db.WithContext(ctx).
		Select(providerListSelectColumns).
		Where("create_user_id = ? AND deleted_at IS NULL", userID).
		Find(&rows).Error; err != nil {
		return row, err
	}

	normalizedRef := normalizeProviderName(ref)
	for i := range rows {
		candidate := rows[i]
		if candidate.DefaultModelProviderID == ref || normalizeProviderName(candidate.Name) == normalizedRef {
			return candidate, nil
		}
	}
	return row, gorm.ErrRecordNotFound
}
