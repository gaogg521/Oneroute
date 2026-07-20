package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
)

func TestParseTaskResult(t *testing.T) {
	a := &TaskAdaptor{}

	cases := []struct {
		name       string
		body       string
		wantStatus model.TaskStatus
		wantURL    string
		wantErr    bool
	}{
		{
			name:       "queued",
			body:       `{"id":"t1","status":"queued"}`,
			wantStatus: model.TaskStatusQueued,
		},
		{
			name:       "running",
			body:       `{"id":"t1","status":"running"}`,
			wantStatus: model.TaskStatusInProgress,
		},
		{
			name:       "succeeded",
			body:       `{"id":"t1","status":"succeeded","content":{"video_url":"https://example.com/v.mp4"}}`,
			wantStatus: model.TaskStatusSuccess,
			wantURL:    "https://example.com/v.mp4",
		},
		{
			name:       "succeeded 3D uses file_url",
			body:       `{"id":"t1","status":"succeeded","content":{"file_url":"https://example.com/model.zip"}}`,
			wantStatus: model.TaskStatusSuccess,
			wantURL:    "https://example.com/model.zip",
		},
		{
			name:       "failed",
			body:       `{"id":"t1","status":"failed","error":{"code":"x","message":"boom"}}`,
			wantStatus: model.TaskStatusFailure,
		},
		{
			name:       "cancelled",
			body:       `{"id":"t1","status":"cancelled"}`,
			wantStatus: model.TaskStatusFailure,
		},
		{
			name:       "expired",
			body:       `{"id":"t1","status":"expired"}`,
			wantStatus: model.TaskStatusFailure,
		},
		{
			name:    "unknown status errors instead of silently reporting progress",
			body:    `{"id":"t1","status":"some_new_status_we_have_never_seen"}`,
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := a.ParseTaskResult([]byte(tc.body))
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got result: %+v", result)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Status != string(tc.wantStatus) {
				t.Fatalf("status = %q, want %q", result.Status, tc.wantStatus)
			}
			if tc.wantURL != "" && result.Url != tc.wantURL {
				t.Fatalf("url = %q, want %q", result.Url, tc.wantURL)
			}
		})
	}
}
