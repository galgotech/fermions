package migrator

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/manager"
)

func (s simpleSecret) reencrypt(ctx context.Context, secretsSrv *manager.SecretsService, sqlStore db.DB) bool {
	var rows []struct {
		Id     int
		Secret []byte
	}

	if err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(s.tableName).Select(fmt.Sprintf("id, %s as secret", s.columnName)).Find(&rows)
	}); err != nil {
		logger.Warn("Could not find any secret to re-encrypt", "table", s.tableName)
		return false
	}

	var anyFailure bool

	for _, row := range rows {
		if len(row.Secret) == 0 {
			continue
		}

		err := sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			decrypted, err := secretsSrv.Decrypt(ctx, row.Secret)
			if err != nil {
				logger.Warn("Could not decrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			encrypted, err := secretsSrv.EncryptWithDBSession(ctx, decrypted, secrets.WithoutScope(), sess.Session)
			if err != nil {
				logger.Warn("Could not encrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			updateSQL := fmt.Sprintf("UPDATE %s SET %s = ?, updated = ? WHERE id = ?", s.tableName, s.columnName)
			if _, err = sess.Exec(updateSQL, encrypted, nowInUTC(), row.Id); err != nil {
				logger.Warn("Could not update secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			return nil
		})

		if err != nil {
			anyFailure = true
		}
	}

	if anyFailure {
		logger.Warn(fmt.Sprintf("Column %s from %s has been re-encrypted with errors", s.columnName, s.tableName))
	} else {
		logger.Info(fmt.Sprintf("Column %s from %s has been re-encrypted successfully", s.columnName, s.tableName))
	}

	return !anyFailure
}

func (s b64Secret) reencrypt(ctx context.Context, secretsSrv *manager.SecretsService, sqlStore db.DB) bool {
	var rows []struct {
		Id     int
		Secret string
	}

	if err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(s.tableName).Select(fmt.Sprintf("id, %s as secret", s.columnName)).Find(&rows)
	}); err != nil {
		logger.Warn("Could not find any secret to re-encrypt", "table", s.tableName)
		return false
	}

	var anyFailure bool

	for _, row := range rows {
		if len(row.Secret) == 0 {
			continue
		}

		err := sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			decoded, err := s.encoding.DecodeString(row.Secret)
			if err != nil {
				logger.Warn("Could not decode base64-encoded secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			decrypted, err := secretsSrv.Decrypt(ctx, decoded)
			if err != nil {
				logger.Warn("Could not decrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			encrypted, err := secretsSrv.EncryptWithDBSession(ctx, decrypted, secrets.WithoutScope(), sess.Session)
			if err != nil {
				logger.Warn("Could not encrypt secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			encoded := s.encoding.EncodeToString(encrypted)
			if s.hasUpdatedColumn {
				updateSQL := fmt.Sprintf("UPDATE %s SET %s = ?, updated = ? WHERE id = ?", s.tableName, s.columnName)
				_, err = sess.Exec(updateSQL, encoded, nowInUTC(), row.Id)
			} else {
				updateSQL := fmt.Sprintf("UPDATE %s SET %s = ? WHERE id = ?", s.tableName, s.columnName)
				_, err = sess.Exec(updateSQL, encoded, row.Id)
			}

			if err != nil {
				logger.Warn("Could not update secret while re-encrypting it", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			return nil
		})

		if err != nil {
			anyFailure = true
		}
	}

	if anyFailure {
		logger.Warn(fmt.Sprintf("Column %s from %s has been re-encrypted with errors", s.columnName, s.tableName))
	} else {
		logger.Info(fmt.Sprintf("Column %s from %s has been re-encrypted successfully", s.columnName, s.tableName))
	}

	return !anyFailure
}

func (s jsonSecret) reencrypt(ctx context.Context, secretsSrv *manager.SecretsService, sqlStore db.DB) bool {
	var rows []struct {
		Id             int
		SecureJsonData map[string][]byte
	}

	if err := sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(s.tableName).Cols("id", "secure_json_data").Find(&rows)
	}); err != nil {
		logger.Warn("Could not find any secret to re-encrypt", "table", s.tableName)
		return false
	}

	var anyFailure bool

	for _, row := range rows {
		if len(row.SecureJsonData) == 0 {
			continue
		}

		err := sqlStore.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			decrypted, err := secretsSrv.DecryptJsonData(ctx, row.SecureJsonData)
			if err != nil {
				logger.Warn("Could not decrypt secrets while re-encrypting them", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			toUpdate := struct {
				SecureJsonData map[string][]byte
				Updated        string
			}{Updated: nowInUTC()}

			toUpdate.SecureJsonData, err = secretsSrv.EncryptJsonDataWithDBSession(ctx, decrypted, secrets.WithoutScope(), sess.Session)
			if err != nil {
				logger.Warn("Could not re-encrypt secrets", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			if _, err := sess.Table(s.tableName).Where("id = ?", row.Id).Update(toUpdate); err != nil {
				logger.Warn("Could not update secrets while re-encrypting them", "table", s.tableName, "id", row.Id, "error", err)
				return err
			}

			return nil
		})

		if err != nil {
			anyFailure = true
		}
	}

	if anyFailure {
		logger.Warn(fmt.Sprintf("Secure json data secrets from %s have been re-encrypted with errors", s.tableName))
	} else {
		logger.Info(fmt.Sprintf("Secure json data secrets from %s have been re-encrypted successfully", s.tableName))
	}

	return !anyFailure
}
